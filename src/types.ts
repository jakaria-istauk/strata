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
  nullable: boolean;
  default: string | null;
  extra: string;
}

export type Row = Record<string, string | null>;

export interface TableInfo {
  name: string;
  rows: number;
  type: string;
  engine: string;
  size: number;
}

export interface RowsResult {
  columns: Column[];
  rows: Row[];
  total: number;
  page: number;
  pages: number;
}

export interface Stats {
  version: string;
  uptime: number;
  dbCount: number;
  tableCount: number;
  dbSize: number;
  threads: number;
  questions: number;
  slowQueries: number;
  bytesReceived: number;
  bytesSent: number;
  breakdown: { db: string; size: number }[];
}

export interface TestConnectionResult {
  ok: true;
  version: string;
  host: string;
}

export type QueryResult =
  | { type: 'result'; columns: string[]; rows: Row[]; rowCount: number; ms: number }
  | { type: 'exec'; affected: number; ms: number };
