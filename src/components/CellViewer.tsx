// Read-only cell inspector. Opened from a grid cell that holds a "rich" value:
//   - json / php  → pretty-printed (with a Raw toggle to see the stored bytes)
//   - datetime     → formatted in a chosen timezone, with offset + relative age
// View only — no editing happens here (that stays in RowDrawer).

import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { Column } from '../types';
import { type RichKind, beautifyJson, beautifyPhp, formatDateTime } from '../lib/dataview';
import TzSelect from './TzSelect';
import { useToast } from './Toast';

interface Props {
  column: Column;
  kind: RichKind;
  value: string;
  onClose: () => void;
}

export default function CellViewer({ column, kind, value, onClose }: Props) {
  const toast = useToast();
  const [raw, setRaw] = useState(false);
  const [tz, setTz] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Beautified form (json/php). null = couldn't parse → show raw, no toggle.
  const pretty = useMemo(() => {
    if (kind === 'json') return beautifyJson(value) ?? null;
    if (kind === 'php') return beautifyPhp(value) ?? null;
    return null;
  }, [kind, value]);

  const dateView = useMemo(
    () => (kind === 'datetime' ? formatDateTime(value, tz, Date.now()) : null),
    [kind, value, tz],
  );

  const showPretty = pretty !== null && !raw;
  const copyText = showPretty ? pretty! : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed.');
    }
  }

  const KIND_LABEL: Record<RichKind, string> = {
    json: 'JSON',
    php: 'PHP serialized',
    datetime: 'Date / time',
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-md"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-sm border-b border-outline-variant px-lg py-md">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-semibold text-on-surface">
              {column.name}
            </h2>
            <p className="font-mono text-xs text-on-surface-variant">{column.coltype}</p>
          </div>
          <span className="ml-sm rounded bg-surface-container-high px-xs py-0.5 text-[10px] uppercase tracking-wide text-on-surface-variant">
            {KIND_LABEL[kind]}
          </span>
          <div className="ml-auto flex items-center gap-sm">
            {pretty !== null && (
              <button
                onClick={() => setRaw((r) => !r)}
                className={`rounded border px-sm py-0.5 text-xs ${
                  raw
                    ? 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                    : 'border-primary bg-secondary-container text-on-secondary-container'
                }`}
                title="Toggle beautified / raw"
              >
                {raw ? 'Raw' : 'Beautified'}
              </button>
            )}
            <button
              onClick={copy}
              className="flex items-center gap-xs rounded border border-outline-variant px-sm py-0.5 text-xs text-on-surface-variant hover:bg-surface-container-high"
              title="Copy"
            >
              {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-lg">
          {kind === 'datetime' ? (
            <div className="space-y-md">
              <div className="flex items-center gap-sm text-sm text-on-surface-variant">
                <span>Timezone</span>
                <TzSelect value={tz} onChange={setTz} />
              </div>
              {dateView ? (
                <div className="space-y-sm">
                  <div className="text-lg font-medium text-on-surface">{dateView.formatted}</div>
                  <div className="flex flex-wrap gap-x-lg gap-y-xs text-sm text-on-surface-variant">
                    <span>{dateView.offset}</span>
                    <span>{dateView.relative}</span>
                  </div>
                  <p className="pt-sm text-xs text-on-surface-variant">
                    Stored value{' '}
                    <span className="font-mono text-on-surface">{value}</span> — interpreted as UTC.
                  </p>
                </div>
              ) : (
                <p className="font-mono text-sm text-on-surface-variant">
                  {value} <span className="italic">(unrecognized date format)</span>
                </p>
              )}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-on-surface">
              {showPretty ? pretty : value}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
