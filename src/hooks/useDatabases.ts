import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useDatabases() {
  return useQuery({
    queryKey: ['databases'],
    queryFn: () => api<{ databases: string[] }>('databases').then((r) => r.databases),
  });
}
