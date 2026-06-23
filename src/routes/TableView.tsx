// Table view — URL-backed grid for /db/:db/table/:table.
// page / sort / dir / search live in the query string (shareable, back-button).

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, Loader2, X } from 'lucide-react';
import { useRows } from '../hooks/useRows';
import Grid from '../components/Grid';
import Pagination from '../components/Pagination';
import ColumnToggle from '../components/ColumnToggle';
import { getHidden, setHidden } from '../lib/columnPrefs';

const PER_PAGE = 50;

export default function TableView() {
  const { db, table } = useParams<{ db: string; table: string }>();
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') ?? '';
  const dir = (params.get('dir') === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC';
  const search = params.get('search') ?? '';

  // Local search field, synced to URL on submit (avoids a request per keystroke).
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  // Hidden columns (localStorage, per db.table). Reload when the table changes.
  const [hidden, setHiddenState] = useState<string[]>([]);
  useEffect(() => {
    setHiddenState(db && table ? getHidden(db, table) : []);
  }, [db, table]);

  function changeHidden(next: string[]) {
    setHiddenState(next);
    if (db && table) setHidden(db, table, next);
  }

  const { data, isFetching, error } = useRows(db, table, {
    page,
    per_page: PER_PAGE,
    sort,
    dir,
    search,
  });

  function patch(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    setParams(sp, { replace: true });
  }

  function onSort(col: string) {
    if (col === sort) patch({ dir: dir === 'ASC' ? 'DESC' : 'ASC', page: null });
    else patch({ sort: col, dir: 'ASC', page: null });
  }

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const visibleColumns = useMemo(
    () => (data?.columns ?? []).filter((c) => !hiddenSet.has(c.name)),
    [data?.columns, hiddenSet],
  );

  return (
    <div className="flex h-full flex-col gap-md p-md">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-md">
        <h1 className="font-display text-base font-semibold text-on-surface">{table}</h1>
        {isFetching && <Loader2 size={14} className="animate-spin text-on-surface-variant" />}
        <form
          className="ml-auto"
          onSubmit={(e) => {
            e.preventDefault();
            patch({ search: searchInput || null, page: null });
          }}
        >
          <div className="relative w-72">
            <Search
              size={14}
              className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search all columns…"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-7 py-sm text-sm text-on-surface outline-none focus:border-primary"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  patch({ search: null, page: null });
                }}
                className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>
        {data && data.columns.length > 0 && (
          <ColumnToggle columns={data.columns} hidden={hidden} onChange={changeHidden} />
        )}
      </div>

      {error ? (
        <div className="rounded-lg bg-error/10 px-md py-sm text-sm text-error">
          {(error as Error).message}
        </div>
      ) : !data ? (
        <div className="flex items-center gap-sm text-sm text-on-surface-variant">
          <Loader2 size={16} className="animate-spin" /> Loading rows…
        </div>
      ) : data.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-outline-variant px-md py-xl text-center text-sm text-on-surface-variant">
          {search ? `No rows match “${search}”.` : 'This table is empty.'}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <Grid
              columns={visibleColumns}
              rows={data.rows}
              sort={sort}
              dir={dir}
              onSort={onSort}
            />
          </div>
          <div className="shrink-0">
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              perPage={data.per_page}
              onPage={(p) => patch({ page: p > 1 ? String(p) : null })}
            />
          </div>
        </>
      )}
    </div>
  );
}
