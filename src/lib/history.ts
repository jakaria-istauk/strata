// SQL query history — kept in localStorage, most-recent first, capped.
// Stored globally (not per-db) so a snippet is reusable across databases.

const KEY = 'strata-query-history';
const MAX = 50;

export interface HistoryEntry {
  sql: string;
  /** Epoch ms of the last run (display only). */
  at: number;
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Record a successfully-run query, de-duped (moves an existing entry to top). */
export function pushHistory(sql: string): HistoryEntry[] {
  const trimmed = sql.trim();
  if (!trimmed) return getHistory();
  const list = getHistory().filter((e) => e.sql !== trimmed);
  list.unshift({ sql: trimmed, at: Date.now() });
  const capped = list.slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(capped));
  return capped;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}
