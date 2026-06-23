// Searchable, free-text column-type picker. The input IS the value; the
// dropdown offers filtered suggestions but any custom type may be typed.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MYSQL_TYPES } from '../lib/mysqlTypes';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function TypeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = value.trim().toLowerCase();
  const shown = MYSQL_TYPES.filter((t) => !q || t.toLowerCase().includes(q));

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="type"
          className="w-full rounded border border-outline-variant bg-surface-container-low px-sm py-1 pr-6 font-mono text-xs text-on-surface outline-none focus:border-primary"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-label="Type suggestions"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {open && shown.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-xs max-h-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface p-xs shadow-xl">
          {shown.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`block w-full rounded px-sm py-1 text-left font-mono text-xs ${
                  t === value
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
