import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { IS_WP } from '../lib/wp';
import type { DbInfo } from '../types';

type DatabasesResponse = { databases: string[]; info?: DbInfo[] };

const fetchDatabases = () => api<DatabasesResponse>('databases');

// WP is locked to the single site DB — the `databases` route doesn't exist
// there, so the cross-db listing query is disabled.
export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: fetchDatabases,
    select: (r) => r.databases,
    enabled: !IS_WP,
  });
}

/** Same query as useDatabases (shared cache), but exposes the per-db rollup. */
export function useDatabaseInfo() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: fetchDatabases,
    select: (r) => r.info ?? [],
    enabled: !IS_WP,
  });
}
