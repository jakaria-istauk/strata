// App shell — gates on an active connection, then renders the Explorer
// (Sidebar + routed main). Real db/table browsing lives under /db/:db/...

import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useMatch, useNavigate } from 'react-router-dom';
import { Settings, Lock, Sun, Moon, Monitor, Maximize2, Minimize2, ChevronRight, Database, Table2, LayoutDashboard, Terminal } from 'lucide-react';
import ConnModal from './components/ConnModal';
import Sidebar from './components/Sidebar';
import TableView from './routes/TableView';
import QueryEditor from './routes/QueryEditor';
import Dashboard from './routes/Dashboard';
import DatabaseList from './routes/DatabaseList';
import TableOverview from './routes/TableOverview';
import { getActiveProfile, needsPassword, setSessionPassword } from './lib/profiles';
import { setTheme, getTheme, type ThemeMode } from './lib/theme';
import { IS_WP, wpBoot } from './lib/wp';

const LOGO_SRC = IS_WP ? `${wpBoot!.assetsUrl}/strata-logo.png` : '/assets/strata-logo.png';

export default function App() {
  // Bump to force a re-read of profile state after CRUD / connect / unlock.
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [showConn, setShowConn] = useState(false);

  // WP host: the site DB is auto-connected (creds in wp-config), so the
  // ConnModal / password gate is skipped and a synthetic profile drives the UI.
  const profile = IS_WP
    ? { id: 'wp', name: 'Site DB' }
    : getActiveProfile();
  const locked = IS_WP ? false : profile ? needsPassword(profile as never) : false;

  // No active profile → force the connection manager (non-dismissable).
  if (!profile) {
    return (
      <Centered>
        <ConnModal dismissable={false} onClose={() => setShowConn(false)} onConnected={refresh} />
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
    <div className="strata-app flex h-screen flex-col bg-background text-on-surface" key={`${profile.id}-${tick}`}>
      <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
        <div className="flex items-center gap-sm">
          <img src={LOGO_SRC} alt="Strata" className="h-6 w-6 rounded" />
          <span className="font-display text-lg font-semibold text-primary">Strata</span>
          <span className="ml-sm rounded-full bg-secondary-container px-sm py-xs text-xs text-on-secondary-container">
            {profile.name}
          </span>
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-sm">
          {IS_WP && <FullscreenToggle />}
          <ThemeToggle />
          {!IS_WP && (
            <button
              onClick={() => setShowConn(true)}
              className="flex items-center gap-sm rounded-lg border border-outline-variant px-md py-sm text-sm hover:bg-surface-container-high"
            >
              <Settings size={16} /> Connections
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Routes>
            {/* WP is locked to the single site DB — no database list; land on it. */}
            <Route
              index
              element={IS_WP ? <Navigate to={`/db/${wpBoot!.siteDb}`} replace /> : <DatabaseList />}
            />
            <Route path="/db/:db" element={<TableOverview />} />
            <Route path="/db/:db/query" element={<QueryEditor />} />
            <Route path="/db/:db/dashboard" element={<Dashboard />} />
            <Route path="/db/:db/table/:table" element={<TableView />} />
            <Route
              path="*"
              element={IS_WP ? <Navigate to={`/db/${wpBoot!.siteDb}`} replace /> : <DatabaseList />}
            />
          </Routes>
        </main>
      </div>

      {!IS_WP && showConn && (
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

// Header breadcrumb — the only path back up from a table to its db's table
// list, and from a db to the database cards. Reads the active db/table/section
// from the URL. In WP the host is locked to one db, so the "Databases" crumb
// (which would link to the hidden DatabaseList) is omitted.
function Breadcrumb() {
  const navigate = useNavigate();
  const tableMatch = useMatch('/db/:db/table/:table');
  const queryMatch = useMatch('/db/:db/query');
  const dashMatch = useMatch('/db/:db/dashboard');
  const dbMatch = useMatch('/db/:db');
  const db =
    tableMatch?.params.db ?? queryMatch?.params.db ?? dashMatch?.params.db ?? dbMatch?.params.db;
  const table = tableMatch?.params.table;

  if (!db) return null;

  const sep = <ChevronRight size={14} className="shrink-0 text-on-surface-variant" />;
  const crumb = 'flex items-center gap-xs rounded-md px-sm py-xs text-sm hover:bg-surface-container-high';

  return (
    <nav className="ml-sm flex items-center gap-xs text-on-surface-variant">
      {!IS_WP && (
        <>
          <button onClick={() => navigate('/')} className={crumb} title="All databases">
            <Database size={14} /> Databases
          </button>
          {sep}
        </>
      )}
      {table || queryMatch || dashMatch ? (
        <button
          onClick={() => navigate(`/db/${encodeURIComponent(db)}`)}
          className={`${crumb} text-on-surface`}
          title="Table list"
        >
          {db}
        </button>
      ) : (
        <span className="px-sm py-xs text-sm font-medium text-on-surface">{db}</span>
      )}
      {table && (
        <>
          {sep}
          <span className="flex items-center gap-xs px-sm py-xs text-sm font-medium text-on-surface">
            <Table2 size={14} /> {table}
          </span>
        </>
      )}
      {queryMatch && (
        <>
          {sep}
          <span className="flex items-center gap-xs px-sm py-xs text-sm font-medium text-on-surface">
            <Terminal size={14} /> SQL
          </span>
        </>
      )}
      {dashMatch && (
        <>
          {sep}
          <span className="flex items-center gap-xs px-sm py-xs text-sm font-medium text-on-surface">
            <LayoutDashboard size={14} /> Dashboard
          </span>
        </>
      )}
    </nav>
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

// WP-only — hides the wp-admin top bar + side menu so Strata fills the screen.
// Toggles a body class that admin.css animates (drawer slide). Choice persists.
const FS_KEY = 'strata-fullscreen';

function FullscreenToggle() {
  const [on, setOn] = useState(() => localStorage.getItem(FS_KEY) === '1');

  useEffect(() => {
    document.body.classList.toggle('strata-fullscreen', on);
    localStorage.setItem(FS_KEY, on ? '1' : '0');
  }, [on]);

  // Esc exits fullscreen.
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOn(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on]);

  // Cleanup if unmounted while active.
  useEffect(() => () => document.body.classList.remove('strata-fullscreen'), []);

  const Icon = on ? Minimize2 : Maximize2;
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="rounded-lg border border-outline-variant p-sm text-on-surface-variant hover:bg-surface-container-high"
      title={on ? 'Exit full screen (Esc)' : 'Full screen'}
      aria-label={on ? 'Exit full screen' : 'Full screen'}
    >
      <Icon size={16} />
    </button>
  );
}

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getTheme());
  const cycle = () => {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light';
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
    <div className="flex h-screen items-center justify-center bg-background p-md">{children}</div>
  );
}
