// Sidebar — database picker + filterable table list. Reads the active db/table
// from the URL (useMatch) and navigates on selection. Server state via hooks.

import { useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Table2, Search, Loader2, LayoutDashboard, Terminal, Plus, Trash2 } from 'lucide-react';
import { useDatabases } from '../hooks/useDatabases';
import { useTables } from '../hooks/useTables';
import DbSelect from './DbSelect';
import NewDbModal from './NewDbModal';
import NewTableModal from './NewTableModal';
import ConfirmDanger from './ConfirmDanger';
import { useToast } from './Toast';
import { api, ApiError } from '../api';

export default function Sidebar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const tableMatch = useMatch('/db/:db/table/:table');
  const queryMatch = useMatch('/db/:db/query');
  const dashMatch = useMatch('/db/:db/dashboard');
  const dbMatch = useMatch('/db/:db');
  const db =
    tableMatch?.params.db ?? queryMatch?.params.db ?? dashMatch?.params.db ?? dbMatch?.params.db;
  const activeTable = tableMatch?.params.table;

  const { data: databases, isLoading: dbsLoading } = useDatabases();
  const { data: tables, isLoading: tablesLoading, error } = useTables(db);
  const [filter, setFilter] = useState('');

  const [showNewDb, setShowNewDb] = useState(false);
  const [showNewTable, setShowNewTable] = useState(false);
  const [confirmDropDb, setConfirmDropDb] = useState(false);

  const dropDb = useMutation({
    mutationFn: () => api<{ ok: true; dropped: string }>('drop_database', { db }),
    onSuccess: (res) => {
      toast.success(`Database “${res.dropped}” dropped.`);
      setConfirmDropDb(false);
      qc.invalidateQueries({ queryKey: ['databases'] });
      navigate('/');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : String(e)),
  });

  const shown = (tables ?? []).filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low">
      {/* DB select + new database */}
      <div className="flex items-center gap-xs border-b border-outline-variant p-sm">
        <div className="min-w-0 flex-1">
          <DbSelect
            databases={databases ?? []}
            value={db}
            loading={dbsLoading}
            onSelect={(d) => navigate(`/db/${encodeURIComponent(d)}`)}
          />
        </div>
        <button
          onClick={() => setShowNewDb(true)}
          title="New database"
          aria-label="New database"
          className="shrink-0 rounded-lg border border-outline-variant bg-surface p-sm text-on-surface-variant hover:bg-surface-container-high"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Db-scoped nav: dashboard + SQL editor */}
      {db && (
        <div className="flex gap-xs border-b border-outline-variant p-sm">
          <button
            onClick={() => navigate(`/db/${encodeURIComponent(db)}/dashboard`)}
            className={`flex flex-1 items-center justify-center gap-sm rounded-lg px-sm py-sm text-sm transition-colors ${
              dashMatch
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button
            onClick={() => navigate(`/db/${encodeURIComponent(db)}/query`)}
            className={`flex flex-1 items-center justify-center gap-sm rounded-lg px-sm py-sm text-sm transition-colors ${
              queryMatch
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <Terminal size={14} /> SQL
          </button>
        </div>
      )}

      {/* Table actions: new table + drop database */}
      {db && (
        <div className="flex items-center gap-xs border-b border-outline-variant px-sm pt-sm">
          <span className="px-xs text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Tables
          </span>
          <button
            onClick={() => setShowNewTable(true)}
            title="New table"
            className="ml-auto flex items-center gap-xs rounded-lg border border-outline-variant px-sm py-1 text-xs text-on-surface hover:bg-surface-container-high"
          >
            <Plus size={13} /> Table
          </button>
          <button
            onClick={() => setConfirmDropDb(true)}
            title="Drop database"
            aria-label="Drop database"
            className="rounded-lg border border-error/40 p-1 text-error hover:bg-error/10"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}

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

      {showNewDb && (
        <NewDbModal
          onClose={() => setShowNewDb(false)}
          onCreated={(name) => {
            setShowNewDb(false);
            navigate(`/db/${encodeURIComponent(name)}`);
          }}
        />
      )}
      {showNewTable && db && (
        <NewTableModal
          db={db}
          onClose={() => setShowNewTable(false)}
          onCreated={(table) => {
            setShowNewTable(false);
            navigate(`/db/${encodeURIComponent(db)}/table/${encodeURIComponent(table)}`);
          }}
        />
      )}
      {confirmDropDb && db && (
        <ConfirmDanger
          title="Drop database"
          message={
            <>
              Permanently drop the database <span className="font-mono font-semibold">{db}</span> and
              all its tables? This cannot be undone.
            </>
          }
          confirmWord={db}
          confirmLabel="Drop database"
          busy={dropDb.isPending}
          onConfirm={() => dropDb.mutate()}
          onCancel={() => setConfirmDropDb(false)}
        />
      )}
    </aside>
  );
}
