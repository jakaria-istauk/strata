// Create-database modal. Names are validated server-side (assertIdent); the new
// database is created utf8mb4 / unicode_ci. On success the caller navigates to it.

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, X, Loader2 } from 'lucide-react';
import { api, ApiError } from '../api';
import { useToast } from './Toast';

interface Props {
  onClose: () => void;
  onCreated: (name: string) => void;
}

export default function NewDbModal({ onClose, onCreated }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState('');

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const create = useMutation({
    mutationFn: () => api<{ ok: true; name: string }>('create_database', { name: name.trim() }),
    onSuccess: (res) => {
      toast.success(`Database “${res.name}” created.`);
      qc.invalidateQueries({ queryKey: ['databases'] });
      onCreated(res.name);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  const valid = /^[A-Za-z0-9_$]{1,64}$/.test(name.trim());

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-md" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !create.isPending) create.mutate();
        }}
        className="w-full max-w-sm animate-pop-in rounded-xl border border-outline-variant bg-surface p-lg shadow-2xl"
      >
        <div className="mb-md flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <Database className="text-primary" size={20} />
            <h2 className="font-display text-lg font-semibold text-on-surface">New database</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="database_name"
          aria-label="Database name"
          className="mb-xs w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm font-mono text-sm text-on-surface outline-none focus:border-primary"
        />
        <p className="mb-md text-xs text-on-surface-variant">
          Letters, digits, <span className="font-mono">_</span> and <span className="font-mono">$</span>{' '}
          only. Created as utf8mb4 / unicode_ci.
        </p>
        <div className="flex items-center justify-end gap-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || create.isPending}
            className="flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
