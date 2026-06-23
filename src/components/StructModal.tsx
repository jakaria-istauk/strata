// Table structure editor — view columns, change name/type/nullable/AI/default,
// add and drop columns. Builds alter_table ops (change/add/drop) on Apply.

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table2, X, Plus, Trash2, Undo2, Loader2, KeyRound } from 'lucide-react';
import { api, ApiError } from '../api';
import { isNullable, type Column } from '../types';
import TypeSelect from './TypeSelect';
import { useToast } from './Toast';

interface Props {
  db: string;
  table: string;
  columns: Column[];
  onClose: () => void;
}

interface ColDraft {
  uid: number;
  orig: string | null; // null = newly added
  name: string;
  type: string;
  nullable: boolean;
  ai: boolean;
  default: string;
  pk: boolean;
  drop: boolean;
}

let uidSeq = 1;

function toDraft(c: Column): ColDraft {
  return {
    uid: uidSeq++,
    orig: c.name,
    name: c.name,
    type: c.coltype,
    nullable: isNullable(c),
    ai: c.extra.includes('auto_increment'),
    default: c.default ?? '',
    pk: c.key === 'PRI',
    drop: false,
  };
}

export default function StructModal({ db, table, columns, onClose }: Props) {
  const toast = useToast();
  const qc = useQueryClient();

  const initial = useMemo(() => columns.map(toDraft), [columns]);
  const [drafts, setDrafts] = useState<ColDraft[]>(initial);
  const initialByUid = useMemo(() => new Map(initial.map((d) => [d.uid, d])), [initial]);

  function update(uid: number, patch: Partial<ColDraft>) {
    setDrafts((list) => list.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  }
  function addColumn() {
    setDrafts((list) => [
      ...list,
      {
        uid: uidSeq++,
        orig: null,
        name: '',
        type: 'VARCHAR(255)',
        nullable: true,
        ai: false,
        default: '',
        pk: false,
        drop: false,
      },
    ]);
  }

  function changed(d: ColDraft) {
    const o = d.orig ? initialByUid.get(d.uid) : undefined;
    if (!o) return false;
    return (
      d.name !== o.name ||
      d.type !== o.type ||
      d.nullable !== o.nullable ||
      d.ai !== o.ai ||
      d.default !== o.default
    );
  }

  const ops = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    for (const d of drafts) {
      const body = {
        name: d.name.trim(),
        type: d.type.trim(),
        nullable: d.nullable,
        auto_increment: d.ai,
        default: d.default,
      };
      if (d.orig && d.drop) out.push({ op: 'drop', name: d.orig });
      else if (!d.orig && !d.drop) out.push({ op: 'add', ...body });
      else if (d.orig && changed(d)) out.push({ op: 'change', orig: d.orig, ...body });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  const invalid = drafts.some((d) => !d.drop && (!d.name.trim() || !d.type.trim()));

  const apply = useMutation({
    mutationFn: () => api<{ ok: true; altered: string }>('alter_table', { db, table, ops }, { db }),
    onSuccess: () => {
      toast.success('Structure updated.');
      qc.invalidateQueries({ queryKey: ['rows', db, table] });
      qc.invalidateQueries({ queryKey: ['tables', db] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-md" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-4xl animate-pop-in flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
          <div className="flex items-center gap-sm">
            <Table2 className="text-primary" size={20} />
            <h2 className="font-display text-lg font-semibold text-on-surface">
              Structure · <span className="font-mono text-base">{table}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant">
                <th className="px-sm pb-sm font-medium">Name</th>
                <th className="px-sm pb-sm font-medium">Type</th>
                <th className="px-sm pb-sm text-center font-medium">Null</th>
                <th className="px-sm pb-sm text-center font-medium">A_I</th>
                <th className="px-sm pb-sm font-medium">Default</th>
                <th className="px-sm pb-sm" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr
                  key={d.uid}
                  className={`align-top ${d.drop ? 'opacity-40' : ''} ${
                    !d.orig ? 'bg-secondary-container/20' : ''
                  }`}
                >
                  <td className="px-sm py-xs">
                    <div className="flex items-center gap-xs">
                      {d.pk && <KeyRound size={11} className="shrink-0 text-primary" />}
                      <input
                        value={d.name}
                        disabled={d.drop}
                        onChange={(e) => update(d.uid, { name: e.target.value })}
                        aria-label="Column name"
                        className="w-full rounded border border-outline-variant bg-surface-container-low px-sm py-1 font-mono text-xs text-on-surface outline-none focus:border-primary disabled:opacity-60"
                      />
                    </div>
                  </td>
                  <td className="w-56 px-sm py-xs">
                    <TypeSelect value={d.type} onChange={(v) => update(d.uid, { type: v })} />
                  </td>
                  <td className="px-sm py-xs text-center">
                    <input
                      type="checkbox"
                      checked={d.nullable}
                      disabled={d.drop}
                      onChange={(e) => update(d.uid, { nullable: e.target.checked })}
                      className="accent-primary"
                      aria-label="Nullable"
                    />
                  </td>
                  <td className="px-sm py-xs text-center">
                    <input
                      type="checkbox"
                      checked={d.ai}
                      disabled={d.drop}
                      onChange={(e) => update(d.uid, { ai: e.target.checked })}
                      className="accent-primary"
                      aria-label="Auto increment"
                    />
                  </td>
                  <td className="px-sm py-xs">
                    <input
                      value={d.default}
                      disabled={d.drop}
                      onChange={(e) => update(d.uid, { default: e.target.value })}
                      placeholder="—"
                      aria-label="Default"
                      className="w-full rounded border border-outline-variant bg-surface-container-low px-sm py-1 font-mono text-xs text-on-surface outline-none focus:border-primary disabled:opacity-60"
                    />
                  </td>
                  <td className="px-sm py-xs text-right">
                    {d.orig ? (
                      <button
                        type="button"
                        onClick={() => update(d.uid, { drop: !d.drop })}
                        className="rounded p-xs text-on-surface-variant hover:bg-surface-container-high"
                        title={d.drop ? 'Keep column' : 'Drop column'}
                      >
                        {d.drop ? <Undo2 size={14} /> : <Trash2 size={14} className="text-error" />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDrafts((l) => l.filter((x) => x.uid !== d.uid))}
                        className="rounded p-xs text-on-surface-variant hover:bg-surface-container-high"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addColumn}
            className="mt-md flex items-center gap-sm rounded-lg border border-dashed border-outline-variant px-md py-sm text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            <Plus size={16} /> Add column
          </button>
        </div>

        <footer className="flex items-center gap-sm border-t border-outline-variant px-lg py-md">
          <span className="text-xs text-on-surface-variant">
            {ops.length} pending change{ops.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || ops.length === 0 || invalid}
            className="flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            {apply.isPending && <Loader2 size={14} className="animate-spin" />}
            Apply changes
          </button>
        </footer>
      </div>
    </div>
  );
}
