// Server dashboard — version, uptime, connection/throughput stats, and a
// per-command query breakdown. Route: /db/:db/dashboard (db optional → also
// shows table count + size for the selected database).

import { useParams } from 'react-router-dom';
import { Loader2, Server, Clock, Database, Table2, HardDrive, Activity } from 'lucide-react';
import { useStats } from '../hooks/useStats';
import type { Stats } from '../types';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Dashboard() {
  const { db } = useParams<{ db: string }>();
  const { data, isLoading, error } = useStats(db);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-sm text-sm text-on-surface-variant">
        <Loader2 size={16} className="animate-spin" /> Loading stats…
      </div>
    );
  }
  if (error) {
    return (
      <div className="m-md rounded-lg bg-error/10 px-md py-sm text-sm text-error">
        {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="h-full overflow-y-auto p-md">
      <h1 className="mb-md font-display text-base font-semibold text-on-surface">
        Dashboard{db ? ` · ${db}` : ''}
      </h1>

      <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
        <Card icon={Server} label="MySQL version" value={data.version} />
        <Card icon={Clock} label="Uptime" value={fmtUptime(data.uptime)} />
        <Card icon={Database} label="Databases" value={data.dbCount.toLocaleString()} />
        {db && <Card icon={Table2} label="Tables" value={data.tableCount.toLocaleString()} />}
        {db && <Card icon={HardDrive} label="Database size" value={fmtBytes(data.dbSize)} />}
        <Card
          icon={Activity}
          label="Connections"
          value={`${data.threadsConnected} (${data.threadsRunning} running)`}
        />
        <Card icon={Activity} label="Questions" value={data.questions.toLocaleString()} />
        <Card icon={Activity} label="Slow queries" value={data.slowQueries.toLocaleString()} />
        <Card icon={HardDrive} label="Bytes sent" value={fmtBytes(data.bytesSent)} />
        <Card icon={HardDrive} label="Bytes received" value={fmtBytes(data.bytesReceived)} />
      </div>

      <h2 className="mb-sm mt-lg font-display text-sm font-semibold text-on-surface">
        Query breakdown
      </h2>
      <Breakdown breakdown={data.breakdown} />
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Server;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-md">
      <div className="mb-sm flex items-center gap-sm text-on-surface-variant">
        <Icon size={16} />
        <span className="text-xs">{label}</span>
      </div>
      <div className="truncate font-display text-xl font-semibold text-on-surface" title={value}>
        {value}
      </div>
    </div>
  );
}

function Breakdown({ breakdown }: { breakdown: Stats['breakdown'] }) {
  const rows = [
    { label: 'SELECT', value: breakdown.select },
    { label: 'INSERT', value: breakdown.insert },
    { label: 'UPDATE', value: breakdown.update },
    { label: 'DELETE', value: breakdown.delete },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-sm rounded-xl border border-outline-variant bg-surface-container-low p-md">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-md">
          <span className="w-16 shrink-0 font-mono text-xs text-on-surface-variant">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-xs text-on-surface">
            {r.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
