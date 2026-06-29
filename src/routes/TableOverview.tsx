// Database overview (db selected, no table) — every table with row estimate,
// type, engine, collation, and size, plus per-row actions. Route: /db/:db.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Table2, Plus, Eye, Trash2 } from 'lucide-react';
import { useTables } from '../hooks/useTables';
import { fmtBytes } from '../lib/format';
import NewTableModal from '../components/NewTableModal';
import ConfirmDanger from '../components/ConfirmDanger';
import { useToast } from '../components/Toast';
import { api, ApiError } from '../api';

export default function TableOverview() {
  const { db } = useParams<{ db: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: tables, isLoading, error } = useTables(db);
  const [showNewTable, setShowNewTable] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const dropTable = useMutation({
    mutationFn: (table: string) =>
      api<{ ok: true; dropped: string }>('drop_table', { db, table }, { db }),
    onSuccess: (res) => {
      toast.success(`Table “${res.dropped}” dropped.`);
      setDropTarget(null);
      qc.invalidateQueries({ queryKey: ['tables', db] });
      qc.invalidateQueries({ queryKey: ['databases'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  const dropSelected = useMutation({
    mutationFn: async (names: string[]) => {
      const dropped: string[] = [];
      const failed: string[] = [];
      // drop_table is single-table; drop sequentially to surface per-table errors.
      for (const table of names) {
        try {
          await api<{ ok: true; dropped: string }>('drop_table', { db, table }, { db });
          dropped.push(table);
        } catch {
          failed.push(table);
        }
      }
      return { dropped, failed };
    },
    onSuccess: ({ dropped, failed }) => {
      if (dropped.length)
        toast.success(`Dropped ${dropped.length} table${dropped.length === 1 ? '' : 's'}.`);
      if (failed.length) toast.error(`Failed to drop: ${failed.join(', ')}`);
      setConfirmBulk(false);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['tables', db] });
      qc.invalidateQueries({ queryKey: ['databases'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  const allSelected = !!tables?.length && tables.every((t) => selected.has(t.name));

  if (!db) return null;

  return (
    <div className="h-full overflow-y-auto p-lg">
      <div className="mx-auto max-w-5xl">
        <div className="mb-lg flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-on-surface">{db}</h1>
            <p className="text-sm text-on-surface-variant">
              {tables ? `${tables.length} table${tables.length === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-sm">
            {selected.size > 0 && (
              <button
                onClick={() => setConfirmBulk(true)}
                className="flex items-center gap-sm rounded-lg border border-error/40 px-md py-sm text-sm font-medium text-error hover:bg-error/10"
              >
                <Trash2 size={16} /> Drop {selected.size} selected
              </button>
            )}
            <button
              onClick={() => setShowNewTable(true)}
              className="flex items-center gap-sm rounded-lg bg-primary px-md py-sm text-sm font-medium text-on-primary hover:opacity-90"
            >
              <Plus size={16} /> New table
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-sm text-sm text-on-surface-variant">
            <Loader2 size={16} className="animate-spin" /> Loading tables…
          </div>
        )}
        {error && <p className="text-sm text-error">{(error as Error).message}</p>}

        {tables && tables.length === 0 && (
          <p className="text-sm text-on-surface-variant">No tables in this database.</p>
        )}

        {tables && tables.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-outline-variant">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
                <tr>
                  <th className="w-10 px-md py-sm text-left font-medium">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      aria-label="Select all tables"
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(tables.map((t) => t.name)) : new Set(),
                        )
                      }
                      className="cursor-pointer accent-primary"
                    />
                  </th>
                  <th className="px-md py-sm text-left font-medium">Table</th>
                  <th className="px-md py-sm text-right font-medium">Rows</th>
                  <th className="px-md py-sm text-left font-medium">Type</th>
                  <th className="px-md py-sm text-left font-medium">Collation</th>
                  <th className="px-md py-sm text-right font-medium">Size</th>
                  <th className="px-md py-sm text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t) => (
                  <tr
                    key={t.name}
                    onClick={() =>
                      navigate(`/db/${encodeURIComponent(db)}/table/${encodeURIComponent(t.name)}`)
                    }
                    className={`cursor-pointer border-t border-outline-variant hover:bg-surface-container-high ${
                      selected.has(t.name) ? 'bg-secondary-container/40' : ''
                    }`}
                  >
                    <td className="px-md py-sm" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.name)}
                        aria-label={`Select ${t.name}`}
                        onChange={() => toggle(t.name)}
                        className="cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-md py-sm">
                      <span className="flex items-center gap-sm font-medium text-on-surface">
                        <Table2 size={14} className="shrink-0 opacity-70" />
                        {t.name}
                      </span>
                    </td>
                    <td className="px-md py-sm text-right tabular-nums text-on-surface-variant">
                      ~{t.rows.toLocaleString()}
                    </td>
                    <td className="px-md py-sm text-on-surface-variant">
                      {t.engine || t.type}
                    </td>
                    <td className="px-md py-sm font-mono text-xs text-on-surface-variant">
                      {t.collation ?? '—'}
                    </td>
                    <td className="px-md py-sm text-right tabular-nums text-on-surface-variant">
                      {fmtBytes(t.size)}
                    </td>
                    <td className="px-md py-sm">
                      <div className="flex items-center justify-end gap-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/db/${encodeURIComponent(db)}/table/${encodeURIComponent(t.name)}`,
                            );
                          }}
                          title="Browse rows"
                          aria-label={`Browse ${t.name}`}
                          className="rounded-lg border border-outline-variant p-1 text-on-surface-variant hover:bg-surface-container-highest"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropTarget(t.name);
                          }}
                          title="Drop table"
                          aria-label={`Drop ${t.name}`}
                          className="rounded-lg border border-error/40 p-1 text-error hover:bg-error/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewTable && (
        <NewTableModal
          db={db}
          onClose={() => setShowNewTable(false)}
          onCreated={(table) => {
            setShowNewTable(false);
            navigate(`/db/${encodeURIComponent(db)}/table/${encodeURIComponent(table)}`);
          }}
        />
      )}

      {dropTarget && (
        <ConfirmDanger
          title="Drop table"
          message={
            <>
              Permanently drop table{' '}
              <span className="font-mono font-semibold text-on-surface">{dropTarget}</span> and all
              its rows? This cannot be undone.
            </>
          }
          confirmWord={dropTarget}
          confirmLabel="Drop table"
          busy={dropTable.isPending}
          onConfirm={() => dropTable.mutate(dropTarget)}
          onCancel={() => setDropTarget(null)}
        />
      )}

      {confirmBulk && (
        <ConfirmDanger
          title={`Drop ${selected.size} table${selected.size === 1 ? '' : 's'}`}
          message={
            <>
              Permanently drop{' '}
              <span className="font-mono font-semibold text-on-surface">{selected.size}</span>{' '}
              table{selected.size === 1 ? '' : 's'} and all their rows? This cannot be undone.
              <span className="mt-sm block max-h-32 overflow-y-auto font-mono text-xs text-on-surface-variant">
                {[...selected].join(', ')}
              </span>
            </>
          }
          confirmWord="DROP"
          confirmLabel={`Drop ${selected.size} table${selected.size === 1 ? '' : 's'}`}
          busy={dropSelected.isPending}
          onConfirm={() => dropSelected.mutate([...selected])}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  );
}
