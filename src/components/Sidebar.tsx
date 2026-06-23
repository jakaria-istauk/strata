// Sidebar — database picker + filterable table list. Reads the active db/table
// from the URL (useMatch) and navigates on selection. Server state via hooks.

import { useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { ChevronDown, Table2, Search, Loader2, Database } from 'lucide-react';
import { useDatabases } from '../hooks/useDatabases';
import { useTables } from '../hooks/useTables';

export default function Sidebar() {
  const navigate = useNavigate();
  const tableMatch = useMatch('/db/:db/table/:table');
  const dbMatch = useMatch('/db/:db');
  const db = tableMatch?.params.db ?? dbMatch?.params.db;
  const activeTable = tableMatch?.params.table;

  const { data: databases, isLoading: dbsLoading } = useDatabases();
  const { data: tables, isLoading: tablesLoading, error } = useTables(db);
  const [filter, setFilter] = useState('');

  const shown = (tables ?? []).filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low">
      {/* DB select */}
      <div className="border-b border-outline-variant p-sm">
        <div className="relative">
          <Database
            size={14}
            className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <select
            value={db ?? ''}
            disabled={dbsLoading}
            onChange={(e) => navigate(`/db/${encodeURIComponent(e.target.value)}`)}
            className="w-full appearance-none rounded-lg border border-outline-variant bg-surface px-7 py-sm text-sm text-on-surface outline-none focus:border-primary"
          >
            <option value="" disabled>
              {dbsLoading ? 'Loading…' : 'Select database'}
            </option>
            {(databases ?? []).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
        </div>
      </div>

      {/* Table filter */}
      {db && (
        <div className="border-b border-outline-variant p-sm">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter tables…"
              className="w-full rounded-lg border border-outline-variant bg-surface px-7 py-sm text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Table list */}
      <nav className="flex-1 overflow-y-auto p-xs">
        {!db && (
          <p className="px-sm py-md text-sm text-on-surface-variant">
            Pick a database to list its tables.
          </p>
        )}
        {db && tablesLoading && (
          <div className="flex items-center gap-sm px-sm py-md text-sm text-on-surface-variant">
            <Loader2 size={14} className="animate-spin" /> Loading tables…
          </div>
        )}
        {error && (
          <p className="px-sm py-md text-sm text-error">{(error as Error).message}</p>
        )}
        {db && !tablesLoading && shown.length === 0 && (
          <p className="px-sm py-md text-sm text-on-surface-variant">
            {tables?.length ? 'No tables match.' : 'No tables in this database.'}
          </p>
        )}
        <ul>
          {shown.map((t) => {
            const active = t.name === activeTable;
            return (
              <li key={t.name}>
                <button
                  onClick={() =>
                    navigate(
                      `/db/${encodeURIComponent(db!)}/table/${encodeURIComponent(t.name)}`,
                    )
                  }
                  className={`flex w-full items-center gap-sm rounded-lg px-sm py-sm text-left text-sm transition-colors ${
                    active
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'text-on-surface hover:bg-surface-container-high'
                  }`}
                  title={`${t.name} · ${t.rows.toLocaleString()} rows`}
                >
                  <Table2 size={14} className="shrink-0 opacity-70" />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-on-surface-variant">
                    {t.rows.toLocaleString()}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
