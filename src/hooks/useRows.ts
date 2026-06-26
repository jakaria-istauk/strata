import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { Filter, RowsResult } from '../types';

export interface RowsParams {
  page: number;
  per_page: number;
  sort: string;
  dir: 'ASC' | 'DESC';
  search: string;
  filters?: Filter[];
}

export function useRows(
  db: string | undefined,
  table: string | undefined,
  params: RowsParams,
) {
  return useQuery({
    queryKey: ['rows', db, table, params],
    enabled: !!db && !!table,
    placeholderData: keepPreviousData, // keep grid visible while paging/sorting
    queryFn: () => api<RowsResult>('rows', { db, table, ...params }, { db }),
  });
}
