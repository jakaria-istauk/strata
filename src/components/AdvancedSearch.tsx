// Advanced search — a slide-in drawer holding a query-builder repeater.
// Each condition is {column, value, bool}: `value` matches with LIKE (exactly
// like the free-text search), and `bool` (AND/OR) joins a row to the previous
// one. Edits propagate live via onChange (TableView debounces into the grid).
// Closing the drawer resets the search (handled by the parent).

import { useState } from 'react';
import { X, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import type { Column, Filter } from '../types';

interface Props {
  table: string;
  columns: Column[];
  value: Filter[];
  onChange: (filters: Filter[]) => void;
  onClose: () => void;
}

export default function AdvancedSearch({ table, columns, value, onChange, onClose }: Props) {
  const [closing, setClosing] = useState(false);
  function requestClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 200); // matches slide-out-right duration
  }

  // Seed with one empty row so the drawer is never blank.
  const rows: Filter[] =
    value.length > 0 ? value : [{ col: columns[0]?.name ?? '', value: '', bool: 'AND' }];

  function update(i: number, patch: Partial<Filter>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    onChange([...rows, { col: columns[0]?.name ?? '', value: '', bool: 'AND' }]);
  }
  function remove(i: number) {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next);
  }
  function clearAll() {
    onChange([]);
  }

  return (
    <div
      className={`strata-overlay fixed inset-0 z-50 flex justify-end bg-black/40 ${
        closing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onClick={requestClose}
    >
      <div
        className={`flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl ${
          closing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
          <div className="flex items-center gap-sm">
            <SlidersHorizontal size={16} className="text-on-surface-variant" />
            <div>
              <h2 className="font-display text-lg font-semibold text-on-surface">Advanced search</h2>
              <p className="text-xs text-on-surface-variant">{table}</p>
            </div>
          </div>
          <button
            onClick={requestClose}
            className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container-high"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-lg py-md">
          <div className="space-y-sm">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-sm">
                {/* boolean joiner — first row is the anchor ("Where") */}
                {i === 0 ? (
                  <span className="w-20 shrink-0 px-sm py-sm text-xs uppercase tracking-wide text-on-surface-variant">
                    Where
                  </span>
                ) : (
                  <select
                    value={r.bool}
                    onChange={(e) => update(i, { bool: e.target.value as 'AND' | 'OR' })}
                    className="w-20 shrink-0 rounded-lg border border-outline-variant bg-surface-container-low px-sm py-sm text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}

                <select
                  value={r.col}
                  onChange={(e) => update(i, { col: e.target.value })}
                  className="w-40 shrink-0 rounded-lg border border-outline-variant bg-surface-container-low px-sm py-sm text-sm text-on-surface outline-none focus:border-primary"
                >
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <input
                  value={r.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="contains…"
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-sm text-on-surface outline-none focus:border-primary"
                />

                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 rounded-lg p-sm text-on-surface-variant hover:bg-error/10 hover:text-error"
                  aria-label="Remove condition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={add}
            className="mt-md flex items-center gap-sm rounded-lg border border-dashed border-outline-variant px-md py-sm text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          >
            <Plus size={14} /> Add condition
          </button>
        </div>

        <footer className="flex items-center justify-between border-t border-outline-variant px-lg py-md">
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-on-surface-variant hover:text-on-surface"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg bg-primary px-md py-sm text-sm font-medium text-on-primary hover:opacity-90"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
