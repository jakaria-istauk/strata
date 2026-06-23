// Data grid — sortable headers, optional row selection + click-to-edit.
// Presentational: sort/selection state + handlers come from TableView.

import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, KeyRound, ExternalLink } from 'lucide-react';
import type { Column, Fks, Row } from '../types';

interface Props {
  /** Active database — needed to build foreign-key links. */
  db: string;
  columns: Column[];
  rows: Row[];
  /** Column → referenced table/column (renders the cell as a link). */
  fks?: Fks;
  sort: string;
  dir: 'ASC' | 'DESC';
  onSort: (col: string) => void;
  /** Row selection — enabled only when the table has a primary key. */
  hasPk: boolean;
  keyOf: (row: Row) => string | null;
  selectedKeys: Set<string>;
  onToggleRow: (row: Row) => void;
  onToggleAll: () => void;
  allChecked: boolean;
  onRowOpen: (row: Row) => void;
}

export default function Grid({
  db,
  columns,
  rows,
  fks,
  sort,
  dir,
  onSort,
  hasPk,
  keyOf,
  selectedKeys,
  onToggleRow,
  onToggleAll,
  allChecked,
  onRowOpen,
}: Props) {
  return (
    <div className="h-full overflow-auto rounded-lg border border-outline-variant">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-container">
          <tr>
            {hasPk && (
              <th className="w-10 border-b border-outline-variant px-md py-sm text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={onToggleAll}
                  className="accent-primary"
                  aria-label="Select all rows"
                />
              </th>
            )}
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
          {rows.map((row, i) => {
            const rk = keyOf(row);
            const selected = rk !== null && selectedKeys.has(rk);
            return (
              <tr
                key={rk ?? i}
                onClick={() => hasPk && onRowOpen(row)}
                className={`${hasPk ? 'cursor-pointer' : ''} ${
                  selected ? 'bg-secondary-container/40' : 'even:bg-surface-container-low'
                } hover:bg-surface-container-high`}
              >
                {hasPk && (
                  <td
                    className="border-b border-outline-variant px-md py-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleRow(row)}
                      className="accent-primary"
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map((c) => {
                  const v = row[c.name];
                  const fk = fks?.[c.name];
                  return (
                    <td
                      key={c.name}
                      className="max-w-xs truncate whitespace-nowrap border-b border-outline-variant px-md py-sm font-mono text-xs text-on-surface"
                      title={
                        fk && v !== null
                          ? `→ ${fk.table}.${fk.column} = ${v}`
                          : (v ?? 'NULL')
                      }
                    >
                      {v === null ? (
                        <span className="italic text-on-surface-variant/60">NULL</span>
                      ) : v === '' ? (
                        <span className="italic text-on-surface-variant/40">empty</span>
                      ) : fk ? (
                        <Link
                          to={`/db/${encodeURIComponent(db)}/table/${encodeURIComponent(
                            fk.table,
                          )}?search=${encodeURIComponent(v)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-xs text-primary hover:underline"
                          title={`→ ${fk.table}.${fk.column} = ${v}`}
                        >
                          {v}
                          <ExternalLink size={11} className="shrink-0 opacity-60" />
                        </Link>
                      ) : (
                        v
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
