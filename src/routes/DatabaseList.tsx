// Landing view (no db selected) — every database as a clickable card with its
// table count, default collation, and on-disk size. Route: index / catch-all.

import { useNavigate } from 'react-router-dom';
import { Loader2, Database, Table2, HardDrive, Plus } from 'lucide-react';
import { useState } from 'react';
import { useDatabaseInfo } from '../hooks/useDatabases';
import { fmtBytes } from '../lib/format';
import NewDbModal from '../components/NewDbModal';

export default function DatabaseList() {
  const navigate = useNavigate();
  const { data: dbs, isLoading, error } = useDatabaseInfo();
  const [showNewDb, setShowNewDb] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-lg">
      <div className="mx-auto max-w-5xl">
        <div className="mb-lg flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-on-surface">Databases</h1>
            <p className="text-sm text-on-surface-variant">
              {dbs ? `${dbs.length} database${dbs.length === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={() => setShowNewDb(true)}
            className="flex items-center gap-sm rounded-lg bg-primary px-md py-sm text-sm font-medium text-on-primary hover:opacity-90"
          >
            <Plus size={16} /> New database
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-sm text-sm text-on-surface-variant">
            <Loader2 size={16} className="animate-spin" /> Loading databases…
          </div>
        )}
        {error && <p className="text-sm text-error">{(error as Error).message}</p>}

        {dbs && (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {dbs.map((d) => (
              <button
                key={d.name}
                onClick={() => navigate(`/db/${encodeURIComponent(d.name)}`)}
                className="group flex flex-col gap-sm rounded-xl border border-outline-variant bg-surface p-md text-left transition-colors hover:border-primary hover:bg-surface-container-high"
              >
                <div className="flex items-center gap-sm">
                  <Database size={18} className="shrink-0 text-primary" />
                  <span className="truncate font-medium text-on-surface group-hover:text-primary">
                    {d.name}
                  </span>
                </div>
                <div className="flex items-center gap-md text-xs text-on-surface-variant">
                  <span className="flex items-center gap-xs">
                    <Table2 size={13} /> {d.tables.toLocaleString()} tables
                  </span>
                  <span className="flex items-center gap-xs">
                    <HardDrive size={13} /> {fmtBytes(d.size)}
                  </span>
                </div>
                {d.collation && (
                  <span className="truncate font-mono text-[11px] text-on-surface-variant">
                    {d.collation}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {showNewDb && (
        <NewDbModal
          onClose={() => setShowNewDb(false)}
          onCreated={(name) => {
            setShowNewDb(false);
            navigate(`/db/${encodeURIComponent(name)}`);
          }}
        />
      )}
    </div>
  );
}
