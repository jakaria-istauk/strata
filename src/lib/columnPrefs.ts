// Per-table column visibility — persisted in localStorage, keyed by db.table.
// Stores the HIDDEN set so newly-added columns default to visible.

const key = (db: string, table: string) => `strata-hidden-cols:${db}.${table}`;

export function getHidden(db: string, table: string): string[] {
  try {
    const raw = localStorage.getItem(key(db, table));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function setHidden(db: string, table: string, hidden: string[]) {
  if (hidden.length) localStorage.setItem(key(db, table), JSON.stringify(hidden));
  else localStorage.removeItem(key(db, table));
}
