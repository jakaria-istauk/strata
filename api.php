<?php
/**
 * NexusDB Pro — JSON API backend (Option C custom UI).
 * Standalone PDO layer over local Herd MySQL. No Adminer dependency.
 *
 * Routing: api.php?action=<name>&...params
 * All identifiers (db/table/column) are validated against live schema
 * before being interpolated, since they cannot be bound parameters.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_USER = 'root';
const DB_PASS = '';

const MAX_PER_PAGE = 500;
const DEFAULT_PER_PAGE = 50;

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function ok(array $data): never {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function pdo(?string $db = null): PDO {
    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
    if ($db !== null) {
        $dsn .= ';dbname=' . $db;
    }
    try {
        return new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        fail(500, 'DB connection failed: ' . $e->getMessage());
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

$action = $_GET['action'] ?? '';

switch ($action) {

    case 'databases': {
        $p = pdo();
        $rows = $p->query(
            "SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA
             ORDER BY SCHEMA_NAME"
        )->fetchAll();
        ok(['databases' => array_column($rows, 'name')]);
    }

    case 'tables': {
        $db = assertDb(pdo(), (string)($_GET['db'] ?? ''));
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
        $db    = assertDb($base, (string)($_GET['db'] ?? ''));
        $table = assertTable($base, $db, (string)($_GET['table'] ?? ''));
        ok(['db' => $db, 'table' => $table, 'columns' => columnsOf($base, $db, $table)]);
    }

    case 'rows': {
        $base  = pdo();
        $db    = assertDb($base, (string)($_GET['db'] ?? ''));
        $table = assertTable($base, $db, (string)($_GET['table'] ?? ''));
        $cols  = columnsOf($base, $db, $table);
        $colNames = array_column($cols, 'name');

        // pagination
        $perPage = (int)($_GET['per_page'] ?? DEFAULT_PER_PAGE);
        $perPage = max(1, min(MAX_PER_PAGE, $perPage));
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $offset  = ($page - 1) * $perPage;

        // sort (validate column against schema)
        $sort = (string)($_GET['sort'] ?? '');
        $dir  = strtoupper((string)($_GET['dir'] ?? 'ASC')) === 'DESC' ? 'DESC' : 'ASC';
        $orderSql = '';
        if ($sort !== '' && in_array($sort, $colNames, true)) {
            $orderSql = ' ORDER BY ' . qid($sort) . ' ' . $dir;
        }

        // search across all columns (LIKE), bound params
        $where  = '';
        $params = [];
        $search = trim((string)($_GET['search'] ?? ''));
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

    default:
        fail(400, 'Unknown action: ' . $action);
}
