// Typed gateway to api.php — the single entry point for all server calls.
// Every request is POST { conn, ...params }; action stays in the query string.
// api.php errors return { error } + non-2xx status → thrown as ApiError.

import type { Conn } from './types';
import { activeConn } from './lib/profiles';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  /** Override the connection (e.g. test_connection before saving a profile). */
  conn?: Conn;
  /** Active database to scope the request to. */
  db?: string;
}

export async function api<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
  opts: ApiOptions = {},
): Promise<T> {
  const conn = opts.conn ?? activeConn(opts.db);
  if (!conn) throw new ApiError('No active connection.', 400);

  let res: Response;
  try {
    res = await fetch(`/api.php?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conn, ...params }),
    });
  } catch {
    throw new ApiError('Network error — is the server reachable?', 0);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Bad response (HTTP ${res.status}).`, res.status);
  }

  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    const msg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}
