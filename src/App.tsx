// Phase 2 shell — gates the app on an active connection. The real Explorer
// (Sidebar + Grid) lands in Phase 3; for now a connected screen proves the
// typed gateway + profiles + ConnModal work end-to-end.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, Settings, Lock, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import ConnModal from './components/ConnModal';
import { api } from './api';
import { getActiveProfile, needsPassword, setSessionPassword } from './lib/profiles';
import { setTheme, getTheme, type ThemeMode } from './lib/theme';

export default function App() {
  // Bump to force a re-read of profile state after CRUD / connect / unlock.
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [showConn, setShowConn] = useState(false);

  const profile = getActiveProfile();
  const locked = profile ? needsPassword(profile) : false;

  // No active profile → force the connection manager (non-dismissable).
  if (!profile) {
    return (
      <Centered>
        <ConnModal
          dismissable={false}
          onClose={() => setShowConn(false)}
          onConnected={refresh}
        />
      </Centered>
    );
  }

  if (locked) {
    return (
      <Centered>
        <PasswordPrompt
          name={profile.name}
          onUnlock={(pass) => {
            setSessionPassword(profile.id, pass);
            refresh();
          }}
          onManage={() => setShowConn(true)}
        />
        {showConn && (
          <ConnModal
            dismissable
            onClose={() => setShowConn(false)}
            onConnected={() => {
              setShowConn(false);
              refresh();
            }}
          />
        )}
      </Centered>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-on-surface" key={tick}>
      <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
        <div className="flex items-center gap-sm">
          <Database className="text-primary" size={22} />
          <span className="font-display text-lg font-semibold text-primary">Strata</span>
          <span className="ml-sm rounded-full bg-secondary-container px-sm py-xs text-xs text-on-secondary-container">
            {profile!.name}
          </span>
        </div>
        <div className="flex items-center gap-sm">
          <ThemeToggle />
          <button
            onClick={() => setShowConn(true)}
            className="flex items-center gap-sm rounded-lg border border-outline-variant px-md py-sm text-sm hover:bg-surface-container-high"
          >
            <Settings size={16} /> Connections
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-lg">
        <DatabaseList key={`${profile!.id}-${tick}`} />
      </main>

      {showConn && (
        <ConnModal
          dismissable
          onClose={() => setShowConn(false)}
          onConnected={() => {
            setShowConn(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function DatabaseList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['databases'],
    queryFn: () => api<{ databases: string[] }>('databases'),
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-sm text-on-surface-variant">
        <Loader2 size={16} className="animate-spin" /> Loading databases…
      </div>
    );

  if (error)
    return (
      <div className="rounded-lg bg-error/10 px-md py-sm text-sm text-error">
        {(error as Error).message}
      </div>
    );

  const dbs = data?.databases ?? [];
  return (
    <div>
      <h2 className="mb-md font-display text-sm font-medium text-on-surface-variant">
        Databases ({dbs.length})
      </h2>
      <ul className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
        {dbs.map((db) => (
          <li
            key={db}
            className="flex items-center gap-sm rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-sm"
          >
            <Database size={14} className="text-primary" /> {db}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PasswordPrompt({
  name,
  onUnlock,
  onManage,
}: {
  name: string;
  onUnlock: (pass: string) => void;
  onManage: () => void;
}) {
  const [pass, setPass] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onUnlock(pass);
      }}
      className="w-full max-w-sm rounded-xl border border-outline-variant bg-surface p-lg shadow-xl"
    >
      <div className="mb-md flex items-center gap-sm">
        <Lock className="text-primary" size={20} />
        <h2 className="font-display text-lg font-semibold">Unlock {name}</h2>
      </div>
      <p className="mb-md text-sm text-on-surface-variant">
        Password isn’t remembered for this connection. Enter it to continue.
      </p>
      <input
        autoFocus
        type="password"
        name="password"
        autoComplete="current-password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Password"
        className="mb-md w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-sm outline-none focus:border-primary"
      />
      <div className="flex items-center gap-sm">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-primary px-md py-sm text-sm font-medium text-on-primary hover:opacity-90"
        >
          Connect
        </button>
        <button
          type="button"
          onClick={onManage}
          className="rounded-lg border border-outline-variant px-md py-sm text-sm hover:bg-surface-container-high"
        >
          Manage
        </button>
      </div>
    </form>
  );
}

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getTheme());
  const cycle = () => {
    const next: ThemeMode =
      mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
    setTheme(next);
    setMode(next);
  };
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button
      onClick={cycle}
      className="rounded-lg border border-outline-variant p-sm text-on-surface-variant hover:bg-surface-container-high"
      title={`Theme: ${mode}`}
      aria-label={`Theme: ${mode}`}
    >
      <Icon size={16} />
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-md">
      {children}
    </div>
  );
}
