<?php
/**
 * Strata — JSON API backend. Standalone PDO layer over any MySQL.
 *
 * Stateless gateway: connection credentials are NOT hardcoded. The client
 * sends them per-request in the JSON body under `conn` (localStorage profiles
 * are the source of truth). See docs/PLAN.md Phase 2.
 *
 * Routing: api.php?action=<name>   (params in query string and/or JSON body)
 * All identifiers (db/table/column) are validated against live schema
 * before being interpolated, since they cannot be bound parameters.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const MAX_PER_PAGE = 500;
const DEFAULT_PER_PAGE = 50;

// ---- request input (query + JSON body) -----------------------------------

$RAW  = file_get_contents('php://input') ?: '';
$BODY = $RAW !== '' ? (json_decode($RAW, true) ?: []) : [];
if (!is_array($BODY)) $BODY = [];
// Params: query string overlaid with JSON body (body wins for non-creds too).
$IN = array_merge($_GET, $BODY);

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function ok(array $data): never {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Connection config from the request body's `conn` object. */
function connConfig(): array {
    global $BODY;
    $c = $BODY['conn'] ?? null;
    if (!is_array($c) || ($c['host'] ?? '') === '' || ($c['user'] ?? '') === '') {
        fail(400, 'No connection: send host/user in the request body `conn`.');
    }
    return [
        'host' => (string)$c['host'],
        'port' => (int)($c['port'] ?? 3306),
        'user' => (string)$c['user'],
        'pass' => (string)($c['pass'] ?? ''),
        'db'   => isset($c['db']) && $c['db'] !== '' ? (string)$c['db'] : null,
    ];
}

function pdo(?string $db = null): PDO {
    $c = connConfig();
    $dsn = 'mysql:host=' . $c['host'] . ';port=' . $c['port'] . ';charset=utf8mb4';
    if ($db !== null) {
        $dsn .= ';dbname=' . $db;
    }
    try {
        return new PDO($dsn, $c['user'], $c['pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        fail(502, 'DB connection failed: ' . $e->getMessage());
    }
}

/** Backtick-quote an identifier already validated against schema. */
function qid(string $id): string {
    return '`' . str_replace('`', '``', $id) . '`';
}

/** Validate a database exists; return it or fail. */
function assertDb(PDO $p, string $db): string {
    $stmt = $p->prepare(
        'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?'
    );
    $stmt->execute([$db]);
    if ($stmt->fetchColumn() === false) {
        fail(404, "Database not found: $db");
    }
    return $db;
}

/** Validate a table exists in db; return it or fail. */
function assertTable(PDO $p, string $db, string $table): string {
    $stmt = $p->prepare(
        'SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
    );
    $stmt->execute([$db, $table]);
    if ($stmt->fetchColumn() === false) {
        fail(404, "Table not found: $table");
    }
    return $table;
}

/** Return ordered column metadata for a validated db.table. */
function columnsOf(PDO $p, string $db, string $table): array {
    $stmt = $p->prepare(
        'SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_KEY AS `key`,
                IS_NULLABLE AS nullable, COLUMN_DEFAULT AS `default`, EXTRA AS extra
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION'
    );
    $stmt->execute([$db, $table]);
    return $stmt->fetchAll();
}

// ---- request dispatch ----------------------------------------------------

$action = (string)($IN['action'] ?? '');

switch ($action) {

    case 'test_connection': {
        $c = connConfig();
        $p = pdo();
        $version = (string)$p->query('SELECT VERSION()')->fetchColumn();
        ok(['ok' => true, 'version' => $version, 'host' => $c['host']]);
    }

    case 'databases': {
        $p = pdo();
        $rows = $p->query(
            "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA
             ORDER BY SCHEMA_NAME"
        )->fetchAll();
        ok(['databases' => array_column($rows, 'name')]);
    }

    case 'tables': {
        $db = assertDb(pdo(), (string)($IN['db'] ?? ''));
        $p  = pdo();
        $stmt = $p->prepare(
            'SELECT TABLE_NAME AS name, TABLE_ROWS AS `rows`, TABLE_TYPE AS type,
                    ENGINE AS engine, DATA_LENGTH + INDEX_LENGTH AS size
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ?
             ORDER BY TABLE_NAME'
        );
        $stmt->execute([$db]);
        ok(['db' => $db, 'tables' => $stmt->fetchAll()]);
    }

    case 'columns': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        ok(['db' => $db, 'table' => $table, 'columns' => columnsOf($base, $db, $table)]);
    }

    case 'rows': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        $cols  = columnsOf($base, $db, $table);
        $colNames = array_column($cols, 'name');

        // pagination
        $perPage = (int)($IN['per_page'] ?? DEFAULT_PER_PAGE);
        $perPage = max(1, min(MAX_PER_PAGE, $perPage));
        $page    = max(1, (int)($IN['page'] ?? 1));
        $offset  = ($page - 1) * $perPage;

        // sort (validate column against schema)
        $sort = (string)($IN['sort'] ?? '');
        $dir  = strtoupper((string)($IN['dir'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $orderSql = '';
        if ($sort !== '' && in_array($sort, $colNames, true)) {
            $orderSql = ' ORDER BY ' . qid($sort) . ' ' . $dir;
        }

        // search across all columns (LIKE), bound params
        $where  = '';
        $params = [];
        $search = trim((string)($IN['search'] ?? ''));
        if ($search !== '') {
            $likes = [];
            foreach ($colNames as $c) {
                $likes[] = 'CAST(' . qid($c) . " AS CHAR) LIKE ?";
                $params[] = '%' . $search . '%';
            }
            $where = ' WHERE (' . implode(' OR ', $likes) . ')';
        }

        $conn = pdo($db);

        // total (filtered) count
        $cnt = $conn->prepare('SELECT COUNT(*) FROM ' . qid($table) . $where);
        $cnt->execute($params);
        $total = (int)$cnt->fetchColumn();

        // page of rows
        $sql = 'SELECT * FROM ' . qid($table) . $where . $orderSql
             . ' LIMIT ' . $perPage . ' OFFSET ' . $offset;
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        ok([
            'db'       => $db,
            'table'    => $table,
            'columns'  => $cols,
            'rows'     => $rows,
            'total'    => $total,
            'page'     => $page,
            'per_page' => $perPage,
            'pages'    => (int)ceil($total / $perPage),
            'sort'     => $sort,
            'dir'      => $dir,
            'search'   => $search,
        ]);
    }

    case 'row_get': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        $cols  = columnsOf($base, $db, $table);
        $colMap = []; foreach ($cols as $c) $colMap[$c['name']] = $c;

        $pk = $IN['pk'] ?? null;
        if (!is_array($pk) || !$pk) fail(400, 'Missing pk');
        $where = []; $params = [];
        foreach ($pk as $k => $v) {
            if (!isset($colMap[$k])) fail(400, "Unknown column: $k");
            $where[] = qid($k) . ' = ?'; $params[] = $v;
        }
        $conn = pdo($db);
        $stmt = $conn->prepare('SELECT * FROM ' . qid($table) . ' WHERE ' . implode(' AND ', $where) . ' LIMIT 1');
        $stmt->execute($params);
        $row = $stmt->fetch();
        if ($row === false) fail(404, 'Row not found');
        ok(['db' => $db, 'table' => $table, 'columns' => $cols, 'row' => $row]);
    }

    case 'row_save': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        $cols  = columnsOf($base, $db, $table);
        $colMap = []; foreach ($cols as $c) $colMap[$c['name']] = $c;

        $values = $IN['values'] ?? null;
        if (!is_array($values)) fail(400, 'Missing values');
        // keep only real columns
        $data = [];
        foreach ($values as $k => $v) if (isset($colMap[$k])) $data[$k] = $v;

        $pk   = $IN['pk'] ?? null; // present => UPDATE, absent => INSERT
        $conn = pdo($db);

        if (is_array($pk) && $pk) {
            $set = []; $params = [];
            foreach ($data as $k => $v) { $set[] = qid($k) . ' = ?'; $params[] = $v; }
            if (!$set) fail(400, 'No columns to update');
            $where = [];
            foreach ($pk as $k => $v) {
                if (!isset($colMap[$k])) fail(400, "Unknown column: $k");
                $where[] = qid($k) . ' = ?'; $params[] = $v;
            }
            $sql = 'UPDATE ' . qid($table) . ' SET ' . implode(', ', $set)
                 . ' WHERE ' . implode(' AND ', $where);
            try {
                $stmt = $conn->prepare($sql); $stmt->execute($params);
            } catch (PDOException $e) { fail(400, $e->getMessage()); }
            ok(['ok' => true, 'mode' => 'update', 'affected' => $stmt->rowCount()]);
        }

        // INSERT — drop empty auto_increment columns so MySQL assigns them
        $insCols = []; $params = [];
        foreach ($data as $k => $v) {
            $c = $colMap[$k];
            if (str_contains($c['extra'], 'auto_increment') && ($v === null || $v === '')) continue;
            $insCols[] = $k; $params[] = $v;
        }
        if (!$insCols) fail(400, 'No values to insert');
        $ph  = implode(', ', array_fill(0, count($insCols), '?'));
        $sql = 'INSERT INTO ' . qid($table) . ' (' . implode(', ', array_map('qid', $insCols))
             . ') VALUES (' . $ph . ')';
        try {
            $stmt = $conn->prepare($sql); $stmt->execute($params);
        } catch (PDOException $e) { fail(400, $e->getMessage()); }
        ok(['ok' => true, 'mode' => 'insert', 'insertId' => $conn->lastInsertId()]);
    }

    case 'row_delete': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        $cols  = columnsOf($base, $db, $table);
        $colMap = []; foreach ($cols as $c) $colMap[$c['name']] = $c;

        $pks = $IN['pks'] ?? null; // array of pk objects
        if (!is_array($pks) || !$pks) fail(400, 'Missing pks');
        $conn = pdo($db);
        $conn->beginTransaction();
        $deleted = 0;
        try {
            foreach ($pks as $pk) {
                if (!is_array($pk) || !$pk) continue;
                $where = []; $params = [];
                foreach ($pk as $k => $v) {
                    if (!isset($colMap[$k])) throw new RuntimeException("Unknown column: $k");
                    $where[] = qid($k) . ' = ?'; $params[] = $v;
                }
                $stmt = $conn->prepare('DELETE FROM ' . qid($table) . ' WHERE ' . implode(' AND ', $where) . ' LIMIT 1');
                $stmt->execute($params);
                $deleted += $stmt->rowCount();
            }
            $conn->commit();
        } catch (Throwable $e) {
            $conn->rollBack();
            fail(400, $e->getMessage());
        }
        ok(['ok' => true, 'deleted' => $deleted]);
    }

    case 'query': {
        $sql = trim((string)($IN['sql'] ?? ''));
        if ($sql === '') fail(400, 'Empty query');
        $db = (string)($IN['db'] ?? '');
        if ($db !== '') assertDb(pdo(), $db);
        $conn = $db !== '' ? pdo($db) : pdo();
        try {
            $t0   = microtime(true);
            $stmt = $conn->query($sql);
            $ms   = round((microtime(true) - $t0) * 1000, 1);
            if ($stmt->columnCount() > 0) {
                $rows = $stmt->fetchAll();
                $names = [];
                for ($i = 0; $i < $stmt->columnCount(); $i++) {
                    $m = $stmt->getColumnMeta($i);
                    $names[] = $m['name'] ?? "col$i";
                }
                ok([
                    'type'     => 'result',
                    'columns'  => array_map(fn($n) => ['name' => $n, 'key' => '', 'type' => ''], $names),
                    'rows'     => $rows,
                    'rowCount' => count($rows),
                    'ms'       => $ms,
                ]);
            }
            ok(['type' => 'exec', 'affected' => $stmt->rowCount(), 'ms' => $ms]);
        } catch (PDOException $e) {
            fail(400, $e->getMessage());
        }
    }

    default:
        fail(400, 'Unknown action: ' . $action);
}
