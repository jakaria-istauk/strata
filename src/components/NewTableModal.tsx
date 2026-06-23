// Create-table modal — table name + a column builder (name / type / null / AI /
// PK). Sends create_table; the new table is InnoDB / utf8mb4. On success the
// caller navigates to it.

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table2, X, Plus, Trash2, Loader2, KeyRound } from 'lucide-react';
import { api, ApiError } from '../api';
import TypeSelect from './TypeSelect';
import { useToast } from './Toast';

interface Props {
  db: string;
  onClose: () => void;
  onCreated: (table: string) => void;
}

interface ColDraft {
  uid: number;
  name: string;
  type: string;
  nullable: boolean;
  ai: boolean;
  pk: boolean;
}

let uidSeq = 1;
const blank = (over: Partial<ColDraft> = {}): ColDraft => ({
  uid: uidSeq++,
  name: '',
  type: 'VARCHAR(255)',
  nullable: true,
  ai: false,
  pk: false,
  ...over,
});

export default function NewTableModal({ db, onClose, onCreated }: Props) {
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [cols, setCols] = useState<ColDraft[]>([
    blank({ name: 'id', type: 'BIGINT UNSIGNED', nullable: false, ai: true, pk: true }),
  ]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  function update(uid: number, patch: Partial<ColDraft>) {
    setCols((list) => list.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  }

  const validName = /^[A-Za-z0-9_$]{1,64}$/.test(name.trim());
  const validCols = cols.length > 0 && cols.every((c) => c.name.trim() && c.type.trim());

  const create = useMutation({
    mutationFn: () =>
      api<{ ok: true; name: string }>(
        'create_table',
        {
          db,
          name: name.trim(),
          columns: cols.map((c) => ({
            name: c.name.trim(),
            type: c.type.trim(),
            nullable: c.nullable,
            auto_increment: c.ai,
            pk: c.pk,
          })),
        },
        { db },
      ),
    onSuccess: (res) => {
      toast.success(`Table “${res.name}” created.`);
      qc.invalidateQueries({ queryKey: ['tables', db] });
      onCreated(res.name);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-md" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl animate-pop-in flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
          <div className="flex items-center gap-sm">
            <Table2 className="text-primary" size={20} />
            <h2 className="font-display text-lg font-semibold text-on-surface">New table</h2>
            <span className="text-xs text-on-surface-variant">in {db}</span>
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
          <label className="mb-xs block text-xs font-medium text-on-surface-variant">
            Table name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="table_name"
            aria-label="Table name"
            className="mb-lg w-full max-w-xs rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm font-mono text-sm text-on-surface outline-none focus:border-primary"
          />

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant">
                <th className="px-sm pb-sm font-medium">Name</th>
                <th className="px-sm pb-sm font-medium">Type</th>
                <th className="px-sm pb-sm text-center font-medium">Null</th>
                <th className="px-sm pb-sm text-center font-medium">A_I</th>
                <th className="px-sm pb-sm text-center font-medium">PK</th>
                <th className="px-sm pb-sm" />
              </tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.uid} className="align-top">
                  <td className="px-sm py-xs">
                    <div className="flex items-center gap-xs">
                      {c.pk && <KeyRound size={11} className="shrink-0 text-primary" />}
                      <input
                        value={c.name}
                        onChange={(e) => update(c.uid, { name: e.target.value })}
                        aria-label="Column name"
                        className="w-full rounded border border-outline-variant bg-surface-container-low px-sm py-1 font-mono text-xs text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                  </td>
                  <td className="w-56 px-sm py-xs">
                    <TypeSelect value={c.type} onChange={(v) => update(c.uid, { type: v })} />
                  </td>
                  <td className="px-sm py-xs text-center">
                    <input
                      type="checkbox"
                      checked={c.nullable}
                      onChange={(e) => update(c.uid, { nullable: e.target.checked })}
                      className="accent-primary"
                      aria-label="Nullable"
                    />
                  </td>
                  <td className="px-sm py-xs text-center">
                    <input
                      type="checkbox"
                      checked={c.ai}
                      onChange={(e) => update(c.uid, { ai: e.target.checked })}
                      className="accent-primary"
                      aria-label="Auto increment"
                    />
                  </td>
                  <td className="px-sm py-xs text-center">
                    <input
                      type="checkbox"
                      checked={c.pk}
                      onChange={(e) =>
                        update(c.uid, { pk: e.target.checked, nullable: e.target.checked ? false : c.nullable })
                      }
                      className="accent-primary"
                      aria-label="Primary key"
                    />
                  </td>
                  <td className="px-sm py-xs text-right">
                    <button
                      type="button"
                      onClick={() => setCols((l) => l.filter((x) => x.uid !== c.uid))}
                      disabled={cols.length === 1}
                      className="rounded p-xs text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30"
                      title="Remove column"
                    >
                      <Trash2 size={14} className="text-error" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={() => setCols((l) => [...l, blank()])}
            className="mt-md flex items-center gap-sm rounded-lg border border-dashed border-outline-variant px-md py-sm text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            <Plus size={16} /> Add column
          </button>
        </div>

        <footer className="flex items-center gap-sm border-t border-outline-variant px-lg py-md">
          <span className="text-xs text-on-surface-variant">
            {cols.length} column{cols.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !validName || !validCols}
            className="flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Create table
          </button>
        </footer>
      </div>
    </div>
  );
}
