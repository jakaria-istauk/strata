// Row drawer — view/edit an existing row or insert a new one. Per-field NULL
// toggle and per-column hash format (persisted by TableView). On save, sends
// `transforms` only for new or edited fields so existing hashes aren't re-hashed.

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, KeyRound, Save } from 'lucide-react';
import { api, ApiError } from '../api';
import {
  isNullable,
  type Column,
  type Formats,
  type HashAlgo,
  type Pk,
  type Row,
  type RowGetResult,
  type RowSaveResult,
} from '../types';
import { useToast } from './Toast';
import HashSelect from './HashSelect';

interface Props {
  db: string;
  table: string;
  columns: Column[];
  mode: 'new' | 'edit';
  pk?: Pk;
  formats: Formats;
  onFormatsChange: (formats: Formats) => void;
  onClose: () => void;
}

const isAuto = (c: Column) => c.extra.includes('auto_increment');

// Long/blob/json columns get a taller editor by default (still user-resizable).
const LONG_TYPES = new Set([
  'text', 'tinytext', 'mediumtext', 'longtext', 'json', 'blob', 'mediumblob', 'longblob',
]);
const isLong = (c: Column) => LONG_TYPES.has(c.type.toLowerCase());

export default function RowDrawer({
  db,
  table,
  columns,
  mode,
  pk,
  formats,
  onFormatsChange,
  onClose,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();

  // Play the exit animation before unmounting (parent removes us on onClose).
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 200); // matches slide-out-right duration
  }

  // Edit mode loads the authoritative row by pk.
  const rowQuery = useQuery({
    queryKey: ['row_get', db, table, pk],
    enabled: mode === 'edit' && !!pk,
    queryFn: () => api<RowGetResult>('row_get', { db, table, pk }, { db }),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [nulls, setNulls] = useState<Set<string>>(new Set());
  const [initial, setInitial] = useState<{ values: Record<string, string>; nulls: Set<string> }>({
    values: {},
    nulls: new Set(),
  });

  // Seed form state from the loaded row (edit) or blanks (new).
  useEffect(() => {
    const seedV: Record<string, string> = {};
    const seedN = new Set<string>();
    const row: Row | undefined = mode === 'edit' ? rowQuery.data?.row : undefined;
    if (mode === 'edit' && !row) return; // wait for fetch
    for (const c of columns) {
      const v = row ? row[c.name] : null;
      if (v === null) {
        if (mode === 'edit') seedN.add(c.name);
        seedV[c.name] = '';
      } else {
        seedV[c.name] = v ?? '';
      }
    }
    setValues(seedV);
    setNulls(seedN);
    setInitial({ values: seedV, nulls: new Set(seedN) });
  }, [columns, mode, rowQuery.data]);

  function setValue(name: string, v: string) {
    setValues((p) => ({ ...p, [name]: v }));
  }
  function toggleNull(name: string) {
    setNulls((p) => {
      const n = new Set(p);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }
  function setFormat(name: string, algo: HashAlgo | '') {
    const next = { ...formats };
    if (algo) next[name] = algo;
    else delete next[name];
    onFormatsChange(next);
  }

  function isDirty(name: string) {
    const wasNull = initial.nulls.has(name);
    const isNull = nulls.has(name);
    if (wasNull !== isNull) return true;
    if (isNull) return false;
    return (initial.values[name] ?? '') !== (values[name] ?? '');
  }

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {};
      const transforms: Record<string, HashAlgo> = {};
      for (const c of columns) {
        // Auto-increment columns are always DB-assigned — never send them.
        if (isAuto(c)) continue;
        payload[c.name] = nulls.has(c.name) ? null : (values[c.name] ?? '');
        const algo = formats[c.name];
        if (algo && (mode === 'new' || isDirty(c.name))) transforms[c.name] = algo;
      }
      return api<RowSaveResult>(
        'row_save',
        {
          db,
          table,
          values: payload,
          ...(mode === 'edit' ? { pk } : {}),
          ...(Object.keys(transforms).length ? { transforms } : {}),
        },
        { db },
      );
    },
    onSuccess: (res) => {
      toast.success(res.mode === 'insert' ? 'Row inserted.' : 'Row updated.');
      qc.invalidateQueries({ queryKey: ['rows', db, table] });
      qc.invalidateQueries({ queryKey: ['tables', db] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  const loading = mode === 'edit' && rowQuery.isLoading;
  const dirtyCount = useMemo(
    () => columns.filter((c) => isDirty(c.name)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, values, nulls, initial],
  );

  return (
    <div
      className={`strata-overlay fixed inset-0 z-50 flex justify-end bg-black/40 ${
        closing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onClick={requestClose}
    >
      <div
        className={`flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl ${
          closing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
          <div>
            <h2 className="font-display text-lg font-semibold text-on-surface">
              {mode === 'new' ? 'New row' : 'Edit row'}
            </h2>
            <p className="text-xs text-on-surface-variant">{table}</p>
          </div>
          <button
            onClick={requestClose}
            className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {rowQuery.error ? (
          <div className="m-lg rounded-lg bg-error/10 px-md py-sm text-sm text-error">
            {(rowQuery.error as Error).message}
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center gap-sm text-sm text-on-surface-variant">
            <Loader2 size={16} className="animate-spin" /> Loading row…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-lg py-md">
            <div className="space-y-md">
              {columns.map((c) => {
                const isNull = nulls.has(c.name);
                const auto = isAuto(c);
                return (
                  <div key={c.name}>
                    <div className="mb-xs flex items-center gap-sm">
                      <label className="flex items-center gap-xs text-xs font-medium text-on-surface">
                        {c.key === 'PRI' && <KeyRound size={11} className="text-primary" />}
                        {c.name}
                        <span className="font-mono font-normal text-on-surface-variant">
                          {c.coltype}
                        </span>
                        {auto && (
                          <span className="rounded bg-surface-container-high px-xs py-0.5 text-[10px] uppercase text-on-surface-variant">
                            auto
                          </span>
                        )}
                      </label>
                      {!auto && (
                      <div className="ml-auto flex items-center gap-sm">
                        <HashSelect
                          value={formats[c.name] ?? ''}
                          onChange={(algo) => setFormat(c.name, algo)}
                        />
                        {isNullable(c) && (
                          <button
                            type="button"
                            onClick={() => toggleNull(c.name)}
                            className={`rounded border px-xs py-0.5 text-xs ${
                              isNull
                                ? 'border-primary bg-secondary-container text-on-secondary-container'
                                : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                            title="Set NULL"
                          >
                            NULL
                          </button>
                        )}
                      </div>
                      )}
                    </div>
                    <textarea
                      rows={isLong(c) ? 6 : 1}
                      aria-label={c.name}
                      disabled={isNull || auto}
                      value={isNull ? '' : (values[c.name] ?? '')}
                      placeholder={auto ? 'auto-increment (assigned by DB)' : isNull ? 'NULL' : ''}
                      onChange={(e) => setValue(c.name, e.target.value)}
                      className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm font-mono text-xs text-on-surface outline-none focus:border-primary disabled:bg-surface-container disabled:italic disabled:text-on-surface-variant/60"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {save.error && (
          <div className="mx-lg mb-xs flex items-start gap-sm rounded-lg border border-error/40 bg-error/10 px-md py-sm text-xs text-error">
            <span className="flex-1 break-words">
              {save.error instanceof ApiError ? save.error.message : String(save.error)}
            </span>
          </div>
        )}

        <footer className="flex items-center gap-sm border-t border-outline-variant px-lg py-md">
          <span className="text-xs text-on-surface-variant">
            {mode === 'edit' ? `${dirtyCount} field${dirtyCount === 1 ? '' : 's'} changed` : ''}
          </span>
          <button
            onClick={requestClose}
            className="ml-auto rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || loading || (mode === 'edit' && dirtyCount === 0)}
            className="flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {mode === 'new' ? 'Insert' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  );
}
