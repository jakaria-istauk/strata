// Searchable database picker — a combobox with type-to-filter. Replaces the
// native <select> so long db lists are navigable.

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Database, Search } from 'lucide-react';

interface Props {
  databases: string[];
  value: string | undefined;
  loading: boolean;
  onSelect: (db: string) => void;
}

export default function DbSelect({ databases, value, loading, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
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

  const shown = databases.filter((d) => d.toLowerCase().includes(filter.toLowerCase()));

  function pick(db: string) {
    setOpen(false);
    setFilter('');
    if (db !== value) onSelect(db);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-sm rounded-lg border border-outline-variant bg-surface px-sm py-sm text-sm text-on-surface outline-none hover:bg-surface-container-high focus:border-primary disabled:opacity-60"
      >
        <Database size={14} className="shrink-0 text-on-surface-variant" />
        <span className={`truncate ${value ? 'text-on-surface' : 'text-on-surface-variant'}`}>
          {loading ? 'Loading…' : (value ?? 'Select database')}
        </span>
        <ChevronDown size={14} className="ml-auto shrink-0 text-on-surface-variant" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-xs rounded-lg border border-outline-variant bg-surface shadow-xl">
          <div className="border-b border-outline-variant p-xs">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                ref={inputRef}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search databases…"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-7 py-sm text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto p-xs">
            {shown.length === 0 && (
              <li className="px-sm py-md text-sm text-on-surface-variant">No matches.</li>
            )}
            {shown.map((d) => (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => pick(d)}
                  className={`flex w-full items-center gap-sm rounded-lg px-sm py-sm text-left text-sm ${
                    d === value
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <Database size={14} className="shrink-0 opacity-70" />
                  <span className="truncate">{d}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
