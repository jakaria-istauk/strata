// Compact hash-format picker — a styled dropdown button (replaces the native
// <select>) consistent with the app's other pickers. List is portalled to
// <body> so the drawer can't clip it. Only 4 options → no search needed.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Hash } from 'lucide-react';
import { HASH_ALGOS } from '../lib/formats';
import type { HashAlgo } from '../types';

interface Props {
  value: HashAlgo | '';
  onChange: (algo: HashAlgo | '') => void;
}

const OPTIONS: Array<{ value: HashAlgo | ''; label: string }> = [
  { value: '', label: 'no hash' },
  ...HASH_ALGOS.map((a) => ({ value: a, label: a })),
];

export default function HashSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const label = value || 'no hash';
  const active = value !== '';

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

  function commit(v: HashAlgo | '') {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Hash format (applied server-side on save)"
        className={`flex items-center gap-xs rounded border px-xs py-0.5 text-xs outline-none ${
          active
            ? 'border-primary bg-secondary-container text-on-secondary-container'
            : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
        }`}
      >
        <Hash size={11} className={active ? 'text-primary' : 'opacity-60'} />
        {label}
        <ChevronDown size={12} className="opacity-70" />
      </button>
      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            style={{ position: 'fixed', top: rect.bottom + 4, left: rect.right - 112, width: 112 }}
            className="z-[100002] rounded-lg border border-outline-variant bg-surface p-xs shadow-xl"
          >
            {OPTIONS.map((o) => (
              <li key={o.value || 'none'}>
                <button
                  type="button"
                  onClick={() => commit(o.value)}
                  className={`block w-full rounded px-sm py-1 text-left text-xs ${
                    o.value === value
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
