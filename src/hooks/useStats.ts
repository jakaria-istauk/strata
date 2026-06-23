import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { Stats } from '../types';

/** Server status + (optional) per-db size/table counts. */
export function useStats(db: string | undefined) {
  return useQuery({
    queryKey: ['stats', db],
    queryFn: () => api<Stats>('stats', db ? { db } : {}, { db }),
  });
}
