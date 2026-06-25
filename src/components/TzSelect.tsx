// Searchable timezone-offset picker. Unlike TypeSelect (free-text), the value
// is constrained to TZ_OPTIONS — the input filters the list, selection commits
// an option's value. List is portalled to <body> so the modal can't clip it.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { TZ_OPTIONS } from '../lib/dataview';

interface Props {
  value: string; // '' (local) or an offset in minutes
  onChange: (value: string) => void;
}

export default function TzSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = useMemo(
    () => TZ_OPTIONS.find((o) => o.value === value)?.label ?? 'Local',
    [value],
  );

  const place = () => {
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const reposition = () => place();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q ? TZ_OPTIONS.filter((o) => o.label.toLowerCase().includes(q)) : TZ_OPTIONS;

  function commit(v: string) {
    onChange(v);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="relative w-36" ref={wrapRef}>
      <div className="relative">
        <input
          value={open ? query : selectedLabel}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder="Search…"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-sm py-xs pr-6 text-sm text-on-surface outline-none focus:border-primary"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-on-surface-variant"
          aria-label="Timezone options"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width }}
            className="z-[80] max-h-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface p-xs shadow-xl"
          >
            {shown.length === 0 ? (
              <li className="px-sm py-1 text-xs text-on-surface-variant">No match</li>
            ) : (
              shown.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => commit(o.value)}
                    className={`block w-full rounded px-sm py-1 text-left text-sm ${
                      o.value === value
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
