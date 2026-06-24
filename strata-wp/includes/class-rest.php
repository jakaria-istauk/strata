<?php
/**
 * REST controller — every Strata action as a WP REST route under strata/v1.
 *
 * Ports the standalone api.php switch verbatim, swapping transport only:
 *  - input comes from WP_REST_Request (JSON body / query), not $_GET/$_BODY
 *  - credentials come from wp-config constants (Strata_DB::pdo), never the wire
 *  - errors render as {"error": msg} + HTTP status (Strata_Fail), matching
 *    api.php's fail() so the front-end contract is unchanged
 *  - every route is cap + nonce gated via Strata_Auth::guard
 *
 * @package Strata
 */

defined( 'ABSPATH' ) || exit;

require_once STRATA_DIR . 'includes/class-db.php';

/**
 * Registers and serves Strata REST routes.
 */
class Strata_REST {

	/**
	 * action => handler method. Each handler takes WP_REST_Request, returns array.
	 *
	 * @var array<string,string>
	 */
	// Database-level routes (databases list, create_database, drop_database) are
	// intentionally ABSENT: the plugin is locked to the single site database
	// (wp-config DB_NAME). Exposing or mutating other schemas on the server would
	// be a cross-tenant privacy/isolation leak. Every action below is forced to
	// the site DB server-side (site_db()), so a tampered `db` param can't escape it.
	private $actions = array(
		'ping'         => 'ping',
		'create_table' => 'create_table',
		'drop_table'   => 'drop_table',
		'alter_table'  => 'alter_table',
		'tables'       => 'tables',
		'columns'      => 'columns',
		'rows'         => 'rows',
		'export_csv'   => 'export_csv',
		'row_get'      => 'row_get',
		'row_save'     => 'row_save',
		'row_delete'   => 'row_delete',
		'query'        => 'query',
		'stats'        => 'stats',
	);

	/**
	 * Hook every action into the REST API.
	 */
	public function register() {
		foreach ( $this->actions as $action => $method ) {
			register_rest_route(
				STRATA_REST_NS,
				'/' . $action,
				array(
					'methods'             => 'POST',
					'callback'            => $this->wrap( $method ),
					'permission_callback' => array( 'Strata_Auth', 'guard' ),
				)
			);
		}
	}

	/**
	 * Wrap a handler: run it, translate Strata_Fail/Throwable into the
	 * {"error": msg} + status shape. export_csv streams + exits inside.
	 *
	 * @param string $method Handler name.
	 * @return callable
	 */
	private function wrap( $method ) {
		return function ( WP_REST_Request $req ) use ( $method ) {
			try {
				$data = $this->$method( $req );
				return new WP_REST_Response( $data, 200 );
			} catch ( Strata_Fail $e ) {
				return new WP_REST_Response( array( 'error' => $e->getMessage() ), (int) $e->getCode() );
			} catch ( Throwable $e ) {
				return new WP_REST_Response( array( 'error' => $e->getMessage() ), 500 );
			}
		};
	}

	/**
	 * Read a param from the request (body or query), like api.php's $IN.
	 *
	 * @param WP_REST_Request $req Request.
	 * @param string          $key Param name.
	 * @param mixed           $def Default.
	 * @return mixed
	 */
	private function in( WP_REST_Request $req, $key, $def = null ) {
		$v = $req->get_param( $key );
		return null === $v ? $def : $v;
	}

	/**
	 * The one database this plugin may touch: the WP site DB from wp-config.
	 * Every handler scopes to this and ignores any client-supplied `db`, so a
	 * tampered request can never reach another schema on the server.
	 *
	 * @return string
	 */
	private function site_db() {
		return defined( 'DB_NAME' ) ? DB_NAME : '';
	}

	// ---- handlers (one per action, mirroring api.php) --------------------

	/** Smoke route — confirms the cap + nonce gate. */
	private function ping( WP_REST_Request $req ) {
		return array(
			'ok'      => true,
			'pong'    => true,
			'user'    => wp_get_current_user()->user_login,
			'version' => STRATA_VERSION,
		);
	}

	private function test_connection( WP_REST_Request $req ) {
		$p       = Strata_DB::pdo();
		$version = (string) $p->query( 'SELECT VERSION()' )->fetchColumn();
		$host    = defined( 'DB_HOST' ) ? DB_HOST : '';
		return array(
			'ok'      => true,
			'version' => $version,
			'host'    => $host,
		);
	}

	private function create_table( WP_REST_Request $req ) {
		$db   = Strata_DB::assert_db( Strata_DB::pdo(), $this->site_db() );
		$name = Strata_DB::assert_ident( (string) $this->in( $req, 'name', '' ), 'table' );
		$cols = $this->in( $req, 'columns' );
		if ( ! is_array( $cols ) || ! $cols ) {
			throw new Strata_Fail( 400, 'At least one column required.' );
		}
		$conn = Strata_DB::pdo( $db );
		$defs = array();
		$pks  = array();
		foreach ( $cols as $c ) {
			if ( ! is_array( $c ) ) {
				continue;
			}
			$defs[] = Strata_DB::col_clause( $conn, $c );
			if ( ! empty( $c['pk'] ) ) {
				$pks[] = Strata_DB::qid( Strata_DB::assert_ident( (string) ( $c['name'] ?? '' ), 'column' ) );
			}
		}
		if ( ! $defs ) {
			throw new Strata_Fail( 400, 'At least one valid column required.' );
		}
		if ( $pks ) {
			$defs[] = 'PRIMARY KEY (' . implode( ', ', $pks ) . ')';
		}
		$sql = 'CREATE TABLE ' . Strata_DB::qid( $name ) . ' (' . implode( ', ', $defs ) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
		try {
			$conn->exec( $sql );
		} catch ( PDOException $e ) {
			throw new Strata_Fail( 400, $e->getMessage() );
		}
		return array(
			'ok'   => true,
			'db'   => $db,
			'name' => $name,
		);
	}

	private function drop_table( WP_REST_Request $req ) {
		$base  = Strata_DB::pdo();
		$db    = Strata_DB::assert_db( $base, $this->site_db() );
		$table = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		try {
			Strata_DB::pdo( $db )->exec( 'DROP TABLE ' . Strata_DB::qid( $table ) );
		} catch ( PDOException $e ) {
			throw new Strata_Fail( 400, $e->getMessage() );
		}
		return array(
			'ok'      => true,
			'dropped' => $table,
		);
	}

	private function alter_table( WP_REST_Request $req ) {
		$base  = Strata_DB::pdo();
		$db    = Strata_DB::assert_db( $base, $this->site_db() );
		$table = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		$names = array_column( Strata_DB::columns_of( $base, $db, $table ), 'name' );

		$ops = $this->in( $req, 'ops' );
		if ( ! is_array( $ops ) || ! $ops ) {
			throw new Strata_Fail( 400, 'No changes to apply.' );
		}
		$conn    = Strata_DB::pdo( $db );
		$clauses = array();
		foreach ( $ops as $op ) {
			if ( ! is_array( $op ) ) {
				continue;
			}
			switch ( (string) ( $op['op'] ?? '' ) ) {
				case 'drop':
					$n = (string) ( $op['name'] ?? '' );
					if ( ! in_array( $n, $names, true ) ) {
						throw new Strata_Fail( 400, "Unknown column: $n" );
					}
					$clauses[] = 'DROP COLUMN ' . Strata_DB::qid( $n );
					break;
				case 'add':
					$clauses[] = 'ADD COLUMN ' . Strata_DB::col_clause( $conn, $op );
					break;
				case 'change':
					$orig = (string) ( $op['orig'] ?? '' );
					if ( ! in_array( $orig, $names, true ) ) {
						throw new Strata_Fail( 400, "Unknown column: $orig" );
					}
					$clauses[] = 'CHANGE COLUMN ' . Strata_DB::qid( $orig ) . ' ' . Strata_DB::col_clause( $conn, $op );
					break;
				default:
					throw new Strata_Fail( 400, 'Bad alter op.' );
			}
		}
		if ( ! $clauses ) {
			throw new Strata_Fail( 400, 'No changes to apply.' );
		}
		try {
			$conn->exec( 'ALTER TABLE ' . Strata_DB::qid( $table ) . ' ' . implode( ', ', $clauses ) );
		} catch ( PDOException $e ) {
			throw new Strata_Fail( 400, $e->getMessage() );
		}
		return array(
			'ok'      => true,
			'altered' => $table,
		);
	}

	private function tables( WP_REST_Request $req ) {
		$db   = Strata_DB::assert_db( Strata_DB::pdo(), $this->site_db() );
		$p    = Strata_DB::pdo();
		$stmt = $p->prepare(
			'SELECT TABLE_NAME AS name, TABLE_ROWS AS `rows`, TABLE_TYPE AS type,
					ENGINE AS engine, TABLE_COLLATION AS collation,
					DATA_LENGTH + INDEX_LENGTH AS size
			 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME'
		);
		$stmt->execute( array( $db ) );
		return array(
			'db'     => $db,
			'tables' => $stmt->fetchAll(),
		);
	}

	private function columns( WP_REST_Request $req ) {
		$base  = Strata_DB::pdo();
		$db    = Strata_DB::assert_db( $base, $this->site_db() );
		$table = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		return array(
			'db'      => $db,
			'table'   => $table,
			'columns' => Strata_DB::columns_of( $base, $db, $table ),
		);
	}

	private function rows( WP_REST_Request $req ) {
		$base     = Strata_DB::pdo();
		$db       = Strata_DB::assert_db( $base, $this->site_db() );
		$table    = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		$cols     = Strata_DB::columns_of( $base, $db, $table );
		$colNames = array_column( $cols, 'name' );

		$perPage = (int) $this->in( $req, 'per_page', Strata_DB::DEFAULT_PER_PAGE );
		$perPage = max( 1, min( Strata_DB::MAX_PER_PAGE, $perPage ) );
		$page    = max( 1, (int) $this->in( $req, 'page', 1 ) );
		$offset  = ( $page - 1 ) * $perPage;

		$sort     = (string) $this->in( $req, 'sort', '' );
		$dir      = strtoupper( (string) $this->in( $req, 'dir', 'ASC' ) ) === 'DESC' ? 'DESC' : 'ASC';
		$orderSql = '';
		if ( '' !== $sort && in_array( $sort, $colNames, true ) ) {
			$orderSql = ' ORDER BY ' . Strata_DB::qid( $sort ) . ' ' . $dir;
		}

		$where  = '';
		$params = array();
		$search = trim( (string) $this->in( $req, 'search', '' ) );
		if ( '' !== $search ) {
			$likes = array();
			foreach ( $colNames as $c ) {
				$likes[]  = 'CAST(' . Strata_DB::qid( $c ) . ' AS CHAR) LIKE ?';
				$params[] = '%' . $search . '%';
			}
			$where = ' WHERE (' . implode( ' OR ', $likes ) . ')';
		}

		$conn = Strata_DB::pdo( $db );
		$cnt  = $conn->prepare( 'SELECT COUNT(*) FROM ' . Strata_DB::qid( $table ) . $where );
		$cnt->execute( $params );
		$total = (int) $cnt->fetchColumn();

		$sql  = 'SELECT * FROM ' . Strata_DB::qid( $table ) . $where . $orderSql . ' LIMIT ' . $perPage . ' OFFSET ' . $offset;
		$stmt = $conn->prepare( $sql );
		$stmt->execute( $params );
		$rows = $stmt->fetchAll();

		return array(
			'db'       => $db,
			'table'    => $table,
			'columns'  => $cols,
			'fks'      => Strata_DB::fks_of( $base, $db, $table ),
			'rows'     => $rows,
			'total'    => $total,
			'page'     => $page,
			'per_page' => $perPage,
			'pages'    => (int) ceil( $total / $perPage ),
			'sort'     => $sort,
			'dir'      => $dir,
			'search'   => $search,
		);
	}

	private function export_csv( WP_REST_Request $req ) {
		$base     = Strata_DB::pdo();
		$db       = Strata_DB::assert_db( $base, $this->site_db() );
		$table    = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		$cols     = Strata_DB::columns_of( $base, $db, $table );
		$colNames = array_column( $cols, 'name' );

		$where  = '';
		$params = array();
		$search = trim( (string) $this->in( $req, 'search', '' ) );
		if ( '' !== $search ) {
			$likes = array();
			foreach ( $colNames as $c ) {
				$likes[]  = 'CAST(' . Strata_DB::qid( $c ) . ' AS CHAR) LIKE ?';
				$params[] = '%' . $search . '%';
			}
			$where = ' WHERE (' . implode( ' OR ', $likes ) . ')';
		}
		$sort     = (string) $this->in( $req, 'sort', '' );
		$dir      = strtoupper( (string) $this->in( $req, 'dir', 'ASC' ) ) === 'DESC' ? 'DESC' : 'ASC';
		$orderSql = ( '' !== $sort && in_array( $sort, $colNames, true ) ) ? ' ORDER BY ' . Strata_DB::qid( $sort ) . ' ' . $dir : '';

		// Stream CSV directly, bypassing REST's JSON serializer.
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $db . '.' . $table . '.csv"' );
		$out = fopen( 'php://output', 'w' );
		fputcsv( $out, $colNames, ',', '"', '' );
		$conn = Strata_DB::pdo( $db );
		$stmt = $conn->prepare( 'SELECT * FROM ' . Strata_DB::qid( $table ) . $where . $orderSql );
		$stmt->execute( $params );
		while ( $row = $stmt->fetch() ) {
			fputcsv( $out, array_map( fn( $v ) => null === $v ? '' : $v, array_values( $row ) ), ',', '"', '' );
		}
		fclose( $out );
		exit;
	}

	private function row_get( WP_REST_Request $req ) {
		$base   = Strata_DB::pdo();
		$db     = Strata_DB::assert_db( $base, $this->site_db() );
		$table  = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		$cols   = Strata_DB::columns_of( $base, $db, $table );
		$colMap = array();
		foreach ( $cols as $c ) {
			$colMap[ $c['name'] ] = $c;
		}
		$pk = $this->in( $req, 'pk' );
		if ( ! is_array( $pk ) || ! $pk ) {
			throw new Strata_Fail( 400, 'Missing pk' );
		}
		$where  = array();
		$params = array();
		foreach ( $pk as $k => $v ) {
			if ( ! isset( $colMap[ $k ] ) ) {
				throw new Strata_Fail( 400, "Unknown column: $k" );
			}
			$where[]  = Strata_DB::qid( $k ) . ' = ?';
			$params[] = $v;
		}
		$conn = Strata_DB::pdo( $db );
		$stmt = $conn->prepare( 'SELECT * FROM ' . Strata_DB::qid( $table ) . ' WHERE ' . implode( ' AND ', $where ) . ' LIMIT 1' );
		$stmt->execute( $params );
		$row = $stmt->fetch();
		if ( false === $row ) {
			throw new Strata_Fail( 404, 'Row not found' );
		}
		return array(
			'db'      => $db,
			'table'   => $table,
			'columns' => $cols,
			'row'     => $row,
		);
	}

	private function row_save( WP_REST_Request $req ) {
		$base   = Strata_DB::pdo();
		$db     = Strata_DB::assert_db( $base, $this->site_db() );
		$table  = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		$cols   = Strata_DB::columns_of( $base, $db, $table );
		$colMap = array();
		foreach ( $cols as $c ) {
			$colMap[ $c['name'] ] = $c;
		}
		$values = $this->in( $req, 'values' );
		if ( ! is_array( $values ) ) {
			throw new Strata_Fail( 400, 'Missing values' );
		}
		$data = array();
		foreach ( $values as $k => $v ) {
			if ( isset( $colMap[ $k ] ) ) {
				$data[ $k ] = $v;
			}
		}
		$transforms = $this->in( $req, 'transforms', array() );
		if ( is_array( $transforms ) ) {
			foreach ( $transforms as $k => $algo ) {
				if ( isset( $data[ $k ] ) && null !== $data[ $k ] && '' !== $data[ $k ]
					&& in_array( $algo, Strata_DB::HASH_ALGOS, true ) ) {
					$data[ $k ] = Strata_DB::hash_val( $algo, (string) $data[ $k ] );
				}
			}
		}
		$pk   = $this->in( $req, 'pk' );
		$conn = Strata_DB::pdo( $db );

		if ( is_array( $pk ) && $pk ) {
			$set    = array();
			$params = array();
			foreach ( $data as $k => $v ) {
				$set[]    = Strata_DB::qid( $k ) . ' = ?';
				$params[] = $v;
			}
			if ( ! $set ) {
				throw new Strata_Fail( 400, 'No columns to update' );
			}
			$where = array();
			foreach ( $pk as $k => $v ) {
				if ( ! isset( $colMap[ $k ] ) ) {
					throw new Strata_Fail( 400, "Unknown column: $k" );
				}
				$where[]  = Strata_DB::qid( $k ) . ' = ?';
				$params[] = $v;
			}
			$sql = 'UPDATE ' . Strata_DB::qid( $table ) . ' SET ' . implode( ', ', $set ) . ' WHERE ' . implode( ' AND ', $where );
			try {
				$stmt = $conn->prepare( $sql );
				$stmt->execute( $params );
			} catch ( PDOException $e ) {
				throw new Strata_Fail( 400, $e->getMessage() );
			}
			return array(
				'ok'       => true,
				'mode'     => 'update',
				'affected' => $stmt->rowCount(),
			);
		}

		$insCols = array();
		$params  = array();
		foreach ( $data as $k => $v ) {
			$c = $colMap[ $k ];
			if ( str_contains( $c['extra'], 'auto_increment' ) && ( null === $v || '' === $v ) ) {
				continue;
			}
			$insCols[] = $k;
			$params[]  = $v;
		}
		if ( ! $insCols ) {
			throw new Strata_Fail( 400, 'No values to insert' );
		}
		$ph  = implode( ', ', array_fill( 0, count( $insCols ), '?' ) );
		$sql = 'INSERT INTO ' . Strata_DB::qid( $table ) . ' (' . implode( ', ', array_map( array( 'Strata_DB', 'qid' ), $insCols ) ) . ') VALUES (' . $ph . ')';
		try {
			$stmt = $conn->prepare( $sql );
			$stmt->execute( $params );
		} catch ( PDOException $e ) {
			throw new Strata_Fail( 400, $e->getMessage() );
		}
		return array(
			'ok'       => true,
			'mode'     => 'insert',
			'insertId' => $conn->lastInsertId(),
		);
	}

	private function row_delete( WP_REST_Request $req ) {
		$base   = Strata_DB::pdo();
		$db     = Strata_DB::assert_db( $base, $this->site_db() );
		$table  = Strata_DB::assert_table( $base, $db, (string) $this->in( $req, 'table', '' ) );
		$cols   = Strata_DB::columns_of( $base, $db, $table );
		$colMap = array();
		foreach ( $cols as $c ) {
			$colMap[ $c['name'] ] = $c;
		}
		$pks = $this->in( $req, 'pks' );
		if ( ! is_array( $pks ) || ! $pks ) {
			throw new Strata_Fail( 400, 'Missing pks' );
		}
		$conn = Strata_DB::pdo( $db );
		$conn->beginTransaction();
		$deleted = 0;
		try {
			foreach ( $pks as $pk ) {
				if ( ! is_array( $pk ) || ! $pk ) {
					continue;
				}
				$where  = array();
				$params = array();
				foreach ( $pk as $k => $v ) {
					if ( ! isset( $colMap[ $k ] ) ) {
						throw new RuntimeException( "Unknown column: $k" );
					}
					$where[]  = Strata_DB::qid( $k ) . ' = ?';
					$params[] = $v;
				}
				$stmt = $conn->prepare( 'DELETE FROM ' . Strata_DB::qid( $table ) . ' WHERE ' . implode( ' AND ', $where ) . ' LIMIT 1' );
				$stmt->execute( $params );
				$deleted += $stmt->rowCount();
			}
			$conn->commit();
		} catch ( Throwable $e ) {
			$conn->rollBack();
			throw new Strata_Fail( 400, $e->getMessage() );
		}
		return array(
			'ok'      => true,
			'deleted' => $deleted,
		);
	}

	/**
	 * Best-effort guard keeping the raw SQL console inside the site DB.
	 *
	 * The PDO connection uses wp-config's (often root) credentials, so without
	 * this a query could reach another site's schema on a shared server. We
	 * can't fully sandbox arbitrary SQL in PHP, but we block the common escapes:
	 * server-wide enumeration (SHOW DATABASES/SCHEMAS), switching DB (USE), and
	 * schema-qualified table references (FROM/JOIN/UPDATE/INTO `other.table`) to
	 * any schema other than the site DB. Unqualified `table.column` is untouched.
	 *
	 * @param string $sql Raw query.
	 * @throws Strata_Fail 403 on a cross-database attempt.
	 */
	private function assert_query_scope( $sql ) {
		if ( preg_match( '/\bshow\s+(databases|schemas)\b/i', $sql )
			|| preg_match( '/\buse\s+[`"\']?[A-Za-z0-9_$]+/i', $sql ) ) {
			throw new Strata_Fail( 403, 'Cross-database access is disabled — Strata is locked to the site database.' );
		}
		$site = strtolower( $this->site_db() );
		if ( preg_match_all( '/\b(?:from|join|into|update|table)\s+[`"\']?([A-Za-z0-9_$]+)[`"\']?\s*\./i', $sql, $m ) ) {
			foreach ( $m[1] as $schema ) {
				if ( strtolower( $schema ) !== $site ) {
					throw new Strata_Fail( 403, "Cross-database access to `$schema` is disabled — Strata is locked to the site database." );
				}
			}
		}
	}

	private function query( WP_REST_Request $req ) {
		$sql = trim( (string) $this->in( $req, 'sql', '' ) );
		if ( '' === $sql ) {
			throw new Strata_Fail( 400, 'Empty query' );
		}
		$this->assert_query_scope( $sql );
		$db = $this->site_db();
		if ( '' !== $db ) {
			Strata_DB::assert_db( Strata_DB::pdo(), $db );
		}
		$conn = '' !== $db ? Strata_DB::pdo( $db ) : Strata_DB::pdo();
		try {
			$t0   = microtime( true );
			$stmt = $conn->query( $sql );
			$ms   = round( ( microtime( true ) - $t0 ) * 1000, 1 );
			if ( $stmt->columnCount() > 0 ) {
				$rows  = $stmt->fetchAll();
				$names = array();
				for ( $i = 0; $i < $stmt->columnCount(); $i++ ) {
					$m       = $stmt->getColumnMeta( $i );
					$names[] = $m['name'] ?? "col$i";
				}
				return array(
					'type'     => 'result',
					'columns'  => array_map(
						fn( $n ) => array(
							'name' => $n,
							'key'  => '',
							'type' => '',
						),
						$names
					),
					'rows'     => $rows,
					'rowCount' => count( $rows ),
					'ms'       => $ms,
				);
			}
			return array(
				'type'     => 'exec',
				'affected' => $stmt->rowCount(),
				'ms'       => $ms,
			);
		} catch ( PDOException $e ) {
			throw new Strata_Fail( 400, $e->getMessage() );
		}
	}

	private function stats( WP_REST_Request $req ) {
		$p      = Strata_DB::pdo();
		$status = array();
		foreach ( $p->query( 'SHOW GLOBAL STATUS' )->fetchAll() as $r ) {
			$status[ $r['Variable_name'] ] = $r['Value'];
		}
		$g          = fn( $k ) => (int) ( $status[ $k ] ?? 0 );
		$version    = (string) $p->query( 'SELECT VERSION()' )->fetchColumn();
		$dbCount    = 1; // Locked to the single site DB — never enumerate all schemas.
		$db         = $this->site_db();
		$tableCount = 0;
		$dbSize     = 0;
		if ( '' !== $db ) {
			Strata_DB::assert_db( $p, $db );
			$stmt = $p->prepare(
				'SELECT COUNT(*) c, COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) s
				 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?'
			);
			$stmt->execute( array( $db ) );
			$row        = $stmt->fetch();
			$tableCount = (int) $row['c'];
			$dbSize     = (int) $row['s'];
		}
		return array(
			'version'          => $version,
			'uptime'           => $g( 'Uptime' ),
			'threadsConnected' => $g( 'Threads_connected' ),
			'threadsRunning'   => $g( 'Threads_running' ),
			'questions'        => $g( 'Questions' ),
			'slowQueries'      => $g( 'Slow_queries' ),
			'bytesSent'        => $g( 'Bytes_sent' ),
			'bytesReceived'    => $g( 'Bytes_received' ),
			'breakdown'        => array(
				'select' => $g( 'Com_select' ),
				'insert' => $g( 'Com_insert' ),
				'update' => $g( 'Com_update' ),
				'delete' => $g( 'Com_delete' ),
			),
			'dbCount'          => $dbCount,
			'db'               => $db,
			'tableCount'       => $tableCount,
			'dbSize'           => $dbSize,
		);
	}
}
