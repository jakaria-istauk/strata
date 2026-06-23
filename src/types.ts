// API contract types — mirror api.php?action=… responses (see CLAUDE.md table).

/** Connection credentials sent per-request in the body `conn`. */
export interface Conn {
  host: string;
  port: number;
  user: string;
  pass: string;
  db?: string;
}

/** A saved connection profile (localStorage). Password persists only when remember=true. */
export interface Profile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  /** Stored only when `remember` is true; otherwise kept in-memory (see profiles.ts). */
  pass?: string;
  remember: boolean;
}

export interface Column {
  name: string;
  type: string;
  /** Full column type, e.g. `varchar(255)`. */
  coltype: string;
  key: string;
  /** From `IS_NULLABLE` — the string `'YES'` or `'NO'`. Use `isNullable()`. */
  nullable: string;
  default: string | null;
  extra: string;
}

/** True when a column accepts NULL (api.php sends IS_NULLABLE as 'YES'/'NO'). */
export const isNullable = (c: Column): boolean => c.nullable === 'YES';

export type Row = Record<string, string | null>;

/** A primary-key locator: column name → value (identifies one row). */
export type Pk = Record<string, string | null>;

/** Per-column server-side hash formats (Strata feature, localStorage). */
export type HashAlgo = 'md5' | 'sha1' | 'sha256';
export type Formats = Record<string, HashAlgo>;

export interface RowGetResult {
  columns: Column[];
  row: Row;
}

export type RowSaveResult =
  | { ok: true; mode: 'update'; affected: number }
  | { ok: true; mode: 'insert'; insertId: string };

export interface TableInfo {
  name: string;
  rows: number;
  type: string;
  engine: string;
  size: number;
}

/** Foreign-key target (api.php `fks` on rows): column name → referenced table/column. */
export interface FkTarget {
  table: string;
  column: string;
}
/** Map of local column name → its foreign-key target. */
export type Fks = Record<string, FkTarget>;

export interface RowsResult {
  db: string;
  table: string;
  columns: Column[];
  fks?: Fks;
  rows: Row[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  sort: string;
  dir: 'ASC' | 'DESC';
  search: string;
}

export interface Stats {
  version: string;
  uptime: number;
  threadsConnected: number;
  threadsRunning: number;
  questions: number;
  slowQueries: number;
  bytesSent: number;
  bytesReceived: number;
  breakdown: { select: number; insert: number; update: number; delete: number };
  dbCount: number;
  db: string;
  tableCount: number;
  dbSize: number;
}

export interface TestConnectionResult {
  ok: true;
  version: string;
  host: string;
}

export type QueryResult =
  | { type: 'result'; columns: string[]; rows: Row[]; rowCount: number; ms: number }
  | { type: 'exec'; affected: number; ms: number };
