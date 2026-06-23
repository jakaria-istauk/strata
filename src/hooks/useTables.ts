import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { TableInfo } from '../types';

export function useTables(db: string | undefined) {
  return useQuery({
    queryKey: ['tables', db],
    enabled: !!db,
    queryFn: () =>
      api<{ tables: TableInfo[] }>('tables', { db }, { db }).then((r) => r.tables),
  });
}
