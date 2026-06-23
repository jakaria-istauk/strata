// Column show/hide menu — checkbox per column, persisted via TableView.
// Closes on outside-click / Escape.

import { useEffect, useRef, useState } from 'react';
import { Columns3, Check } from 'lucide-react';
import type { Column } from '../types';

interface Props {
  columns: Column[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}

export default function ColumnToggle({ columns, hidden, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const hiddenSet = new Set(hidden);
  const visibleCount = columns.length - hidden.length;

  function toggle(name: string) {
    const next = new Set(hiddenSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    // Never allow hiding the last visible column.
    if (next.size >= columns.length) return;
    onChange([...next]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-sm text-on-surface hover:bg-surface-container-high"
        title="Show/hide columns"
      >
        <Columns3 size={14} />
        Columns
        <span className="text-xs text-on-surface-variant">
          {visibleCount}/{columns.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-xs max-h-80 w-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface p-xs shadow-xl">
          {columns.map((c) => {
            const visible = !hiddenSet.has(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggle(c.name)}
                className="flex w-full items-center gap-sm rounded-lg px-sm py-sm text-left text-sm text-on-surface hover:bg-surface-container-high"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    visible
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant'
                  }`}
                >
                  {visible && <Check size={12} />}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
