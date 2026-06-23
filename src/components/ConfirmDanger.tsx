// Type-to-confirm destructive action modal. The confirm button stays disabled
// until the user types `confirmWord` exactly.

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  title: string;
  message: React.ReactNode;
  confirmWord: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDanger({
  title,
  message,
  confirmWord,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState('');
  const armed = value === confirmWord;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-md"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-md flex items-center gap-sm">
          <AlertTriangle className="text-error" size={20} />
          <h2 className="font-display text-lg font-semibold text-on-surface">{title}</h2>
        </div>
        <div className="mb-md text-sm text-on-surface-variant">{message}</div>
        <p className="mb-xs text-xs text-on-surface-variant">
          Type <span className="font-mono font-semibold text-on-surface">{confirmWord}</span> to
          confirm.
        </p>
        <input
          autoFocus
          aria-label={`Type ${confirmWord} to confirm`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && armed && !busy && onConfirm()}
          className="mb-md w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-sm text-on-surface outline-none focus:border-error"
        />
        <div className="flex items-center justify-end gap-sm">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!armed || busy}
            className="flex items-center gap-sm rounded-lg bg-error px-lg py-sm text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
