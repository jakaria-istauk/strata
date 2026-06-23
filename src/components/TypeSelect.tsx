// Searchable, free-text column-type picker. The input IS the value; the
// dropdown offers filtered suggestions but any custom type may be typed.
// The list is portalled to <body> with fixed positioning so it isn't clipped
// by the modal's scroll container.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { MYSQL_TYPES } from '../lib/mysqlTypes';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function TypeSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

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

  const q = value.trim().toLowerCase();
  const filtered = MYSQL_TYPES.filter((t) => t.toLowerCase().includes(q));
  // Fall back to the full list when the current value matches nothing, so the
  // picker is always usable (a committed type like `varchar(100)` filters to 0).
  const shown = q && filtered.length ? filtered : MYSQL_TYPES;

  return (
    <div className="relative" ref={wrapRef}>
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
      {open &&
        rect &&
        shown.length > 0 &&
        createPortal(
          <ul
            ref={listRef}
            style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width }}
            className="z-[80] max-h-56 overflow-y-auto rounded-lg border border-outline-variant bg-surface p-xs shadow-xl"
          >
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
          </ul>,
          document.body,
        )}
    </div>
  );
}
