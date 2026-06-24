import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { DbInfo } from '../types';

type DatabasesResponse = { databases: string[]; info?: DbInfo[] };

const fetchDatabases = () => api<DatabasesResponse>('databases');

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: fetchDatabases,
    select: (r) => r.databases,
  });
}

/** Same query as useDatabases (shared cache), but exposes the per-db rollup. */
export function useDatabaseInfo() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: fetchDatabases,
    select: (r) => r.info ?? [],
  });
}
