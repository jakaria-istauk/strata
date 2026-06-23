// Per-column hash formats — a Strata-only property kept in localStorage,
// keyed by db.table. On row save the client sends `transforms` for new/edited
// fields and api.php hashes server-side (see CLAUDE.md).

import type { Formats, HashAlgo } from '../types';

export const HASH_ALGOS: HashAlgo[] = ['md5', 'sha1', 'sha256'];

const key = (db: string, table: string) => `strata-formats:${db}.${table}`;

export function getFormats(db: string, table: string): Formats {
  try {
    const raw = localStorage.getItem(key(db, table));
    return raw ? (JSON.parse(raw) as Formats) : {};
  } catch {
    return {};
  }
}

export function setFormats(db: string, table: string, formats: Formats) {
  if (Object.keys(formats).length) localStorage.setItem(key(db, table), JSON.stringify(formats));
  else localStorage.removeItem(key(db, table));
}
