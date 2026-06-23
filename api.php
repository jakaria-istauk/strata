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

/** Validate a *new* identifier (db/table/column name) before it exists in schema. */
function assertIdent(string $id, string $what): string {
    if (!preg_match('/^[A-Za-z0-9_$]{1,64}$/', $id)) {
        fail(400, "Invalid $what name (use letters, digits, _ or \$; max 64).");
    }
    return $id;
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

/** Map of column => {table,column} for foreign keys on a validated db.table. */
function fksOf(PDO $p, string $db, string $table): array {
    $stmt = $p->prepare(
        'SELECT COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS reftable, REFERENCED_COLUMN_NAME AS refcol
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL'
    );
    $stmt->execute([$db, $table]);
    $out = [];
    foreach ($stmt->fetchAll() as $r) {
        $out[$r['col']] = ['table' => $r['reftable'], 'column' => $r['refcol']];
    }
    return $out;
}

/** Return ordered column metadata for a validated db.table. */
function columnsOf(PDO $p, string $db, string $table): array {
    $stmt = $p->prepare(
        'SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS coltype,
                COLUMN_KEY AS `key`, IS_NULLABLE AS nullable,
                COLUMN_DEFAULT AS `default`, EXTRA AS extra
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION'
    );
    $stmt->execute([$db, $table]);
    return $stmt->fetchAll();
}

/**
 * Build one column definition for CREATE/ALTER from a client-supplied spec.
 * Name is identifier-validated; type is regex-checked; default is quoted
 * (expression defaults like CURRENT_TIMESTAMP pass through unquoted).
 */
function colClause(PDO $p, array $c): string {
    $cn   = assertIdent((string)($c['name'] ?? ''), 'column');
    $type = trim((string)($c['type'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9_ ,()\']{1,128}$/', $type)) {
        fail(400, "Invalid column type: $type");
    }
    $def = qid($cn) . ' ' . $type . (!empty($c['nullable']) ? ' NULL' : ' NOT NULL');
    if (!empty($c['auto_increment'])) $def .= ' AUTO_INCREMENT';
    $d = $c['default'] ?? null;
    if ($d !== null && $d !== '') {
        $d = (string)$d;
        // known expression/keyword defaults pass through; everything else is a string literal
        if (preg_match('/^(current_timestamp(\(\d*\))?|now\(\)|true|false|null)$/i', $d)) {
            $def .= ' DEFAULT ' . $d;
        } else {
            $def .= ' DEFAULT ' . $p->quote($d);
        }
    }
    return $def;
}

/** Hash a value for a "format" column. Whitelisted algorithms only. */
function hashVal(string $algo, string $v): string {
    return match ($algo) {
        'md5'    => md5($v),
        'sha1'   => sha1($v),
        'sha256' => hash('sha256', $v),
        default  => $v,
    };
}
const HASH_ALGOS = ['md5', 'sha1', 'sha256'];

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

    case 'create_database': {
        $name = assertIdent((string)($IN['name'] ?? ''), 'database');
        $p = pdo();
        try {
            $p->exec('CREATE DATABASE ' . qid($name)
                . ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        } catch (PDOException $e) { fail(400, $e->getMessage()); }
        ok(['ok' => true, 'name' => $name]);
    }

    case 'create_table': {
        $db   = assertDb(pdo(), (string)($IN['db'] ?? ''));
        $name = assertIdent((string)($IN['name'] ?? ''), 'table');
        $cols = $IN['columns'] ?? null;
        if (!is_array($cols) || !$cols) fail(400, 'At least one column required.');

        $conn = pdo($db);
        $defs = []; $pks = [];
        foreach ($cols as $c) {
            if (!is_array($c)) continue;
            $defs[] = colClause($conn, $c);   // name/type/nullable/AI/default
            if (!empty($c['pk'])) $pks[] = qid(assertIdent((string)($c['name'] ?? ''), 'column'));
        }
        if (!$defs) fail(400, 'At least one valid column required.');
        if ($pks)  $defs[] = 'PRIMARY KEY (' . implode(', ', $pks) . ')';

        $sql = 'CREATE TABLE ' . qid($name) . ' (' . implode(', ', $defs)
             . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
        try { $conn->exec($sql); }
        catch (PDOException $e) { fail(400, $e->getMessage()); }
        ok(['ok' => true, 'db' => $db, 'name' => $name]);
    }

    case 'drop_database': {
        $db = assertDb(pdo(), (string)($IN['db'] ?? ''));
        try { pdo()->exec('DROP DATABASE ' . qid($db)); }
        catch (PDOException $e) { fail(400, $e->getMessage()); }
        ok(['ok' => true, 'dropped' => $db]);
    }

    case 'drop_table': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        try { pdo($db)->exec('DROP TABLE ' . qid($table)); }
        catch (PDOException $e) { fail(400, $e->getMessage()); }
        ok(['ok' => true, 'dropped' => $table]);
    }

    case 'alter_table': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        $names = array_column(columnsOf($base, $db, $table), 'name');

        $ops = $IN['ops'] ?? null;   // [{op:'change'|'add'|'drop', ...}]
        if (!is_array($ops) || !$ops) fail(400, 'No changes to apply.');

        $conn = pdo($db);
        $clauses = [];
        foreach ($ops as $op) {
            if (!is_array($op)) continue;
            switch ((string)($op['op'] ?? '')) {
                case 'drop': {
                    $n = (string)($op['name'] ?? '');
                    if (!in_array($n, $names, true)) fail(400, "Unknown column: $n");
                    $clauses[] = 'DROP COLUMN ' . qid($n);
                    break;
                }
                case 'add':
                    $clauses[] = 'ADD COLUMN ' . colClause($conn, $op);
                    break;
                case 'change': {
                    $orig = (string)($op['orig'] ?? '');
                    if (!in_array($orig, $names, true)) fail(400, "Unknown column: $orig");
                    $clauses[] = 'CHANGE COLUMN ' . qid($orig) . ' ' . colClause($conn, $op);
                    break;
                }
                default:
                    fail(400, 'Bad alter op.');
            }
        }
        if (!$clauses) fail(400, 'No changes to apply.');
        try { $conn->exec('ALTER TABLE ' . qid($table) . ' ' . implode(', ', $clauses)); }
        catch (PDOException $e) { fail(400, $e->getMessage()); }
        ok(['ok' => true, 'altered' => $table]);
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
            'fks'      => fksOf($base, $db, $table),
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

    case 'export_csv': {
        $base  = pdo();
        $db    = assertDb($base, (string)($IN['db'] ?? ''));
        $table = assertTable($base, $db, (string)($IN['table'] ?? ''));
        $cols  = columnsOf($base, $db, $table);
        $colNames = array_column($cols, 'name');

        // optional search filter (mirrors the rows action)
        $where = ''; $params = [];
        $search = trim((string)($IN['search'] ?? ''));
        if ($search !== '') {
            $likes = [];
            foreach ($colNames as $c) { $likes[] = 'CAST(' . qid($c) . ' AS CHAR) LIKE ?'; $params[] = '%' . $search . '%'; }
            $where = ' WHERE (' . implode(' OR ', $likes) . ')';
        }
        $sort = (string)($IN['sort'] ?? '');
        $dir  = strtoupper((string)($IN['dir'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $orderSql = ($sort !== '' && in_array($sort, $colNames, true)) ? ' ORDER BY ' . qid($sort) . ' ' . $dir : '';

        // stream CSV directly (no full buffering)
        header_remove('Content-Type');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $db . '.' . $table . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, $colNames, ',', '"', '');
        $conn = pdo($db);
        $stmt = $conn->prepare('SELECT * FROM ' . qid($table) . $where . $orderSql);
        $stmt->execute($params);
        while ($row = $stmt->fetch()) {
            fputcsv($out, array_map(fn($v) => $v === null ? '' : $v, array_values($row)), ',', '"', '');
        }
        fclose($out);
        exit;
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

        // "format" columns: hash the value before it touches the DB (md5/sha1/sha256).
        // Client sends transforms only for fields it actually wants hashed (new rows,
        // or edited fields) so existing hashes aren't re-hashed on an untouched edit.
        $transforms = $IN['transforms'] ?? [];
        if (is_array($transforms)) {
            foreach ($transforms as $k => $algo) {
                if (isset($data[$k]) && $data[$k] !== null && $data[$k] !== ''
                    && in_array($algo, HASH_ALGOS, true)) {
                    $data[$k] = hashVal($algo, (string)$data[$k]);
                }
            }
        }

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

    case 'stats': {
        $p = pdo();
        $status = [];
        foreach ($p->query('SHOW GLOBAL STATUS')->fetchAll() as $r) {
            $status[$r['Variable_name']] = $r['Value'];
        }
        $g = fn(string $k) => (int)($status[$k] ?? 0);
        $version = (string)$p->query('SELECT VERSION()')->fetchColumn();
        $dbCount = (int)$p->query('SELECT COUNT(*) FROM information_schema.SCHEMATA')->fetchColumn();

        $db = (string)($IN['db'] ?? '');
        $tableCount = 0; $dbSize = 0;
        if ($db !== '') {
            assertDb($p, $db);
            $stmt = $p->prepare(
                'SELECT COUNT(*) c, COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) s
                 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?'
            );
            $stmt->execute([$db]);
            $row = $stmt->fetch();
            $tableCount = (int)$row['c'];
            $dbSize     = (int)$row['s'];
        }
        ok([
            'version'          => $version,
            'uptime'           => $g('Uptime'),
            'threadsConnected' => $g('Threads_connected'),
            'threadsRunning'   => $g('Threads_running'),
            'questions'        => $g('Questions'),
            'slowQueries'      => $g('Slow_queries'),
            'bytesSent'        => $g('Bytes_sent'),
            'bytesReceived'    => $g('Bytes_received'),
            'breakdown'        => [
                'select' => $g('Com_select'),
                'insert' => $g('Com_insert'),
                'update' => $g('Com_update'),
                'delete' => $g('Com_delete'),
            ],
            'dbCount'    => $dbCount,
            'db'         => $db,
            'tableCount' => $tableCount,
            'dbSize'     => $dbSize,
        ]);
    }

    default:
        fail(400, 'Unknown action: ' . $action);
}
