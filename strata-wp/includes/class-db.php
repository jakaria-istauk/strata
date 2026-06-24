<?php
/**
 * DB engine — PDO factory + identifier guards, ported verbatim from the
 * standalone api.php. The ONLY change vs standalone: credentials come from
 * wp-config constants server-side, never from the request body.
 *
 * @package Strata
 */

defined( 'ABSPATH' ) || exit;

/**
 * Thrown by engine helpers to signal an HTTP-coded failure. Caught by the
 * REST controller and rendered as {"error": msg} with the right status —
 * matching standalone api.php's fail() contract so the front-end is unchanged.
 */
class Strata_Fail extends Exception {
	/**
	 * @param int    $status HTTP status code.
	 * @param string $msg    Human-readable error.
	 */
	public function __construct( $status, $msg ) {
		parent::__construct( $msg, $status );
	}
}

/**
 * Stateless PDO helpers over the site MySQL. Mirrors api.php's free functions.
 */
class Strata_DB {

	const MAX_PER_PAGE     = 500;
	const DEFAULT_PER_PAGE = 50;
	const HASH_ALGOS       = array( 'md5', 'sha1', 'sha256' );

	/**
	 * Parse wp-config DB_HOST into host/port/socket. WP allows
	 * "host", "host:port", "host:/path/to/socket", ":/socket".
	 *
	 * @return array{host:string,port:int,socket:?string}
	 */
	private static function parse_host() {
		$raw = defined( 'DB_HOST' ) ? DB_HOST : '127.0.0.1';
		$host = $raw;
		$port = 3306;
		$socket = null;
		if ( strpos( $raw, ':' ) !== false ) {
			list( $h, $p ) = explode( ':', $raw, 2 );
			$host = $h;
			if ( $p !== '' && $p[0] === '/' ) {
				$socket = $p;
			} elseif ( is_numeric( $p ) ) {
				$port = (int) $p;
			}
		}
		return array(
			'host'   => '' === $host ? 'localhost' : $host,
			'port'   => $port,
			'socket' => $socket,
		);
	}

	/**
	 * Build a PDO connection from wp-config constants. Optionally selects a db.
	 *
	 * @param string|null $db Database to USE, or null.
	 * @return PDO
	 * @throws Strata_Fail On connect failure.
	 */
	public static function pdo( $db = null ) {
		$c = self::parse_host();
		if ( $c['socket'] ) {
			$dsn = 'mysql:unix_socket=' . $c['socket'] . ';charset=utf8mb4';
		} else {
			$dsn = 'mysql:host=' . $c['host'] . ';port=' . $c['port'] . ';charset=utf8mb4';
		}
		if ( null !== $db ) {
			$dsn .= ';dbname=' . $db;
		}
		try {
			return new PDO(
				$dsn,
				defined( 'DB_USER' ) ? DB_USER : 'root',
				defined( 'DB_PASSWORD' ) ? DB_PASSWORD : '',
				array(
					PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
					PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
					PDO::ATTR_EMULATE_PREPARES   => false,
				)
			);
		} catch ( PDOException $e ) {
			throw new Strata_Fail( 502, 'DB connection failed: ' . $e->getMessage() );
		}
	}

	/** Backtick-quote an identifier already validated against schema. */
	public static function qid( $id ) {
		return '`' . str_replace( '`', '``', $id ) . '`';
	}

	/** Validate a *new* identifier (db/table/column) before it exists in schema. */
	public static function assert_ident( $id, $what ) {
		if ( ! preg_match( '/^[A-Za-z0-9_$]{1,64}$/', $id ) ) {
			throw new Strata_Fail( 400, "Invalid $what name (use letters, digits, _ or \$; max 64)." );
		}
		return $id;
	}

	/** Validate a database exists; return it or fail. */
	public static function assert_db( PDO $p, $db ) {
		$stmt = $p->prepare( 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?' );
		$stmt->execute( array( $db ) );
		if ( false === $stmt->fetchColumn() ) {
			throw new Strata_Fail( 404, "Database not found: $db" );
		}
		return $db;
	}

	/** Validate a table exists in db; return it or fail. */
	public static function assert_table( PDO $p, $db, $table ) {
		$stmt = $p->prepare(
			'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
		);
		$stmt->execute( array( $db, $table ) );
		if ( false === $stmt->fetchColumn() ) {
			throw new Strata_Fail( 404, "Table not found: $table" );
		}
		return $table;
	}

	/** Map of column => {table,column} for foreign keys on a validated db.table. */
	public static function fks_of( PDO $p, $db, $table ) {
		$stmt = $p->prepare(
			'SELECT COLUMN_NAME AS col, REFERENCED_TABLE_NAME AS reftable, REFERENCED_COLUMN_NAME AS refcol
			 FROM information_schema.KEY_COLUMN_USAGE
			 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL'
		);
		$stmt->execute( array( $db, $table ) );
		$out = array();
		foreach ( $stmt->fetchAll() as $r ) {
			$out[ $r['col'] ] = array(
				'table'  => $r['reftable'],
				'column' => $r['refcol'],
			);
		}
		return $out;
	}

	/** Return ordered column metadata for a validated db.table. */
	public static function columns_of( PDO $p, $db, $table ) {
		$stmt = $p->prepare(
			'SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS coltype,
					COLUMN_KEY AS `key`, IS_NULLABLE AS nullable,
					COLUMN_DEFAULT AS `default`, EXTRA AS extra
			 FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
			 ORDER BY ORDINAL_POSITION'
		);
		$stmt->execute( array( $db, $table ) );
		return $stmt->fetchAll();
	}

	/**
	 * Build one column definition for CREATE/ALTER from a client spec.
	 * Name identifier-validated; type regex-checked; default quoted
	 * (CURRENT_TIMESTAMP-style defaults pass through unquoted).
	 */
	public static function col_clause( PDO $p, array $c ) {
		$cn   = self::assert_ident( (string) ( $c['name'] ?? '' ), 'column' );
		$type = trim( (string) ( $c['type'] ?? '' ) );
		if ( ! preg_match( '/^[A-Za-z0-9_ ,()\']{1,128}$/', $type ) ) {
			throw new Strata_Fail( 400, "Invalid column type: $type" );
		}
		$def = self::qid( $cn ) . ' ' . $type . ( ! empty( $c['nullable'] ) ? ' NULL' : ' NOT NULL' );
		if ( ! empty( $c['auto_increment'] ) ) {
			$def .= ' AUTO_INCREMENT';
		}
		$d = $c['default'] ?? null;
		if ( null !== $d && '' !== $d ) {
			$d = (string) $d;
			if ( preg_match( '/^(current_timestamp(\(\d*\))?|now\(\)|true|false|null)$/i', $d ) ) {
				$def .= ' DEFAULT ' . $d;
			} else {
				$def .= ' DEFAULT ' . $p->quote( $d );
			}
		}
		return $def;
	}

	/** Hash a value for a "format" column. Whitelisted algorithms only. */
	public static function hash_val( $algo, $v ) {
		switch ( $algo ) {
			case 'md5':
				return md5( $v );
			case 'sha1':
				return sha1( $v );
			case 'sha256':
				return hash( 'sha256', $v );
			default:
				return $v;
		}
	}
}
