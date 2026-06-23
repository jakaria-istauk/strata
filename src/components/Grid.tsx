// Data grid — renders a page of rows with sortable headers. Presentational:
// sort state + handler are passed down from TableView (URL-backed).

import { ArrowDown, ArrowUp, KeyRound } from 'lucide-react';
import type { Column, Row } from '../types';

interface Props {
  columns: Column[];
  rows: Row[];
  sort: string;
  dir: 'ASC' | 'DESC';
  onSort: (col: string) => void;
}

export default function Grid({ columns, rows, sort, dir, onSort }: Props) {
  return (
    <div className="overflow-auto rounded-lg border border-outline-variant">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-container">
          <tr>
            {columns.map((c) => {
              const isSorted = c.name === sort;
              return (
                <th
                  key={c.name}
                  className="whitespace-nowrap border-b border-outline-variant px-md py-sm text-left font-medium text-on-surface-variant"
                >
                  <button
                    onClick={() => onSort(c.name)}
                    className="group inline-flex items-center gap-xs hover:text-on-surface"
                    title={c.coltype}
                  >
                    {c.key === 'PRI' && (
                      <KeyRound size={12} className="text-primary" aria-label="Primary key" />
                    )}
                    <span>{c.name}</span>
                    {isSorted ? (
                      dir === 'ASC' ? (
                        <ArrowUp size={12} className="text-primary" />
                      ) : (
                        <ArrowDown size={12} className="text-primary" />
                      )
                    ) : (
                      <ArrowUp
                        size={12}
                        className="opacity-0 transition-opacity group-hover:opacity-40"
                      />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-surface-container-low hover:bg-surface-container-high">
              {columns.map((c) => {
                const v = row[c.name];
                return (
                  <td
                    key={c.name}
                    className="max-w-xs truncate whitespace-nowrap border-b border-outline-variant px-md py-sm font-mono text-xs text-on-surface"
                    title={v ?? 'NULL'}
                  >
                    {v === null ? (
                      <span className="italic text-on-surface-variant/60">NULL</span>
                    ) : v === '' ? (
                      <span className="italic text-on-surface-variant/40">empty</span>
                    ) : (
                      v
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
