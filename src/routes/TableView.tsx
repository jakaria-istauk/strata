// Table view — URL-backed grid for /db/:db/table/:table.
// page / sort / dir / search live in the query string (shareable, back-button).
// Owns row selection, the row drawer (new/edit), per-column formats, bulk delete.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, X, Plus, Trash2, Table2, Download } from 'lucide-react';
import { useRows } from '../hooks/useRows';
import Grid from '../components/Grid';
import Pagination from '../components/Pagination';
import ColumnToggle from '../components/ColumnToggle';
import RowDrawer from '../components/RowDrawer';
import StructModal from '../components/StructModal';
import ConfirmDanger from '../components/ConfirmDanger';
import CellViewer from '../components/CellViewer';
import { useToast } from '../components/Toast';
import { api, ApiError, exportCsv } from '../api';
import { getFormats, setFormats as persistFormats } from '../lib/formats';
import type { RichKind } from '../lib/dataview';
import type { Column, Formats, Pk, Row } from '../types';

const PER_PAGE = 50;

type Drawer = { mode: 'new' } | { mode: 'edit'; pk: Pk } | null;

export default function TableView() {
  const { db, table } = useParams<{ db: string; table: string }>();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const qc = useQueryClient();

  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') ?? '';
  const dir = (params.get('dir') === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC';
  const search = params.get('search') ?? '';

  // Local search field, synced to URL. Debounced search-as-you-type (300ms);
  // Enter still submits immediately via the form below.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => patch({ search: searchInput || null, page: null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Hidden columns — in-memory only (resets when the table changes).
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => setHidden([]), [db, table]);

  // Per-column hash formats — persisted in localStorage per db.table.
  const [formats, setFormatsState] = useState<Formats>({});
  useEffect(() => setFormatsState(db && table ? getFormats(db, table) : {}), [db, table]);
  function changeFormats(next: Formats) {
    setFormatsState(next);
    if (db && table) persistFormats(db, table, next);
  }

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [cell, setCell] = useState<{ column: Column; kind: RichKind; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showStruct, setShowStruct] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isFetching, error } = useRows(db, table, {
    page,
    per_page: PER_PAGE,
    sort,
    dir,
    search,
  });

  // Clear selection whenever the result set shifts (page/sort/search/table).
  useEffect(() => setSelected(new Set()), [db, table, page, sort, dir, search]);

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

  // Primary-key handling — required for selection, edit, and delete.
  const pkCols = useMemo(
    () => (data?.columns ?? []).filter((c) => c.key === 'PRI'),
    [data?.columns],
  );
  const hasPk = pkCols.length > 0;
  const pkOf = (row: Row): Pk => Object.fromEntries(pkCols.map((c) => [c.name, row[c.name]]));
  const keyOf = (row: Row): string | null =>
    hasPk ? JSON.stringify(pkCols.map((c) => row[c.name])) : null;

  // Map current page's selected keys back to pk objects (selection resets per page).
  const pkByKey = useMemo(() => {
    const m = new Map<string, Pk>();
    for (const r of data?.rows ?? []) {
      const k = keyOf(r);
      if (k) m.set(k, pkOf(r));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.rows, pkCols]);

  function toggleRow(row: Row) {
    const k = keyOf(row);
    if (!k) return;
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }
  function toggleAll() {
    setSelected((p) => {
      if (p.size === (data?.rows.length ?? 0)) return new Set();
      return new Set((data?.rows ?? []).map(keyOf).filter((k): k is string => k !== null));
    });
  }

  const del = useMutation({
    mutationFn: () => {
      const pks = [...selected].map((k) => pkByKey.get(k)).filter((p): p is Pk => !!p);
      return api<{ ok: true; deleted: number }>('row_delete', { db, table, pks }, { db });
    },
    onSuccess: (res) => {
      toast.success(`Deleted ${res.deleted} row${res.deleted === 1 ? '' : 's'}.`);
      setSelected(new Set());
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ['rows', db, table] });
      qc.invalidateQueries({ queryKey: ['tables', db] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  async function doExport() {
    if (!db || !table || exporting) return;
    setExporting(true);
    try {
      await exportCsv(db, table, { search, sort, dir });
      toast.success('CSV exported.');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  // Keyboard shortcuts: `/` focus search, `n` new row, `e` export
  // (ignored while typing in a field or with a modal/drawer open).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      if (drawer || showStruct || confirmDelete || cell) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n' && data) {
        e.preventDefault();
        setDrawer({ mode: 'new' });
      } else if (e.key === 'e' && data) {
        e.preventDefault();
        doExport();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, drawer, showStruct, confirmDelete, cell, db, table, search, sort, dir, exporting]);

  const allChecked = !!data && data.rows.length > 0 && selected.size === data.rows.length;

  return (
    <div className="flex h-full flex-col gap-md p-md">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-md">
        <h1 className="font-display text-base font-semibold text-on-surface">{table}</h1>
        {isFetching && <Loader2 size={14} className="animate-spin text-on-surface-variant" />}

        {selected.size > 0 && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-sm rounded-lg border border-error/40 px-md py-sm text-sm text-error hover:bg-error/10"
          >
            <Trash2 size={14} /> Delete ({selected.size})
          </button>
        )}

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
              ref={searchRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search all columns…  ( / )"
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
          <ColumnToggle columns={data.columns} hidden={hidden} onChange={setHidden} />
        )}
        <button
          onClick={doExport}
          disabled={!data || exporting}
          title="Export all matching rows to CSV (e)"
          className="flex items-center gap-sm rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-40"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export
        </button>
        <button
          onClick={() => setShowStruct(true)}
          disabled={!data}
          className="flex items-center gap-sm rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-40"
        >
          <Table2 size={14} /> Structure
        </button>
        <button
          onClick={() => setDrawer({ mode: 'new' })}
          disabled={!data}
          className="flex items-center gap-sm rounded-lg bg-primary px-md py-sm text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-40"
        >
          <Plus size={14} /> New row
        </button>
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
              db={db!}
              columns={visibleColumns}
              rows={data.rows}
              fks={data.fks}
              sort={sort}
              dir={dir}
              onSort={onSort}
              hasPk={hasPk}
              keyOf={keyOf}
              selectedKeys={selected}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              allChecked={allChecked}
              onRowOpen={(row) => setDrawer({ mode: 'edit', pk: pkOf(row) })}
              onCellView={(column, kind, value) => setCell({ column, kind, value })}
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

      {drawer && data && db && table && (
        <RowDrawer
          db={db}
          table={table}
          columns={data.columns}
          mode={drawer.mode}
          pk={drawer.mode === 'edit' ? drawer.pk : undefined}
          formats={formats}
          onFormatsChange={changeFormats}
          onClose={() => setDrawer(null)}
        />
      )}

      {cell && (
        <CellViewer
          column={cell.column}
          kind={cell.kind}
          value={cell.value}
          onClose={() => setCell(null)}
        />
      )}

      {showStruct && data && db && table && (
        <StructModal db={db} table={table} columns={data.columns} onClose={() => setShowStruct(false)} />
      )}

      {confirmDelete && (
        <ConfirmDanger
          title="Delete rows"
          message={`Permanently delete ${selected.size} selected row${
            selected.size === 1 ? '' : 's'
          } from ${table}? This cannot be undone.`}
          confirmWord="DELETE"
          busy={del.isPending}
          onConfirm={() => del.mutate()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
