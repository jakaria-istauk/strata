// Connection manager — list saved profiles, CRUD, test, and pick the active one.
// Profiles live in localStorage (lib/profiles); passwords persist only when
// "Remember" is on, else cached in-memory for the session.

import { useState } from 'react';
import { Database, Plus, Pencil, Trash2, Check, Loader2, X } from 'lucide-react';
import type { Profile, TestConnectionResult } from '../types';
import {
  getProfiles,
  saveProfile,
  deleteProfile,
  setActiveId,
  connFor,
} from '../lib/profiles';
import { api, ApiError } from '../api';

interface Props {
  /** Hide the close button + backdrop dismiss when there is no usable connection. */
  dismissable: boolean;
  onClose: () => void;
  /** Called after a profile is selected/connected so the app can re-gate. */
  onConnected: () => void;
}

type Draft = {
  id?: string;
  name: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  remember: boolean;
};

const blankDraft: Draft = {
  name: '',
  host: '127.0.0.1',
  port: '3306',
  user: 'root',
  pass: '',
  remember: false,
};

function toDraft(p: Profile): Draft {
  return {
    id: p.id,
    name: p.name,
    host: p.host,
    port: String(p.port),
    user: p.user,
    pass: p.pass ?? '',
    remember: p.remember,
  };
}

export default function ConnModal({ dismissable, onClose, onConnected }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(getProfiles());
  const [draft, setDraft] = useState<Draft | null>(
    profiles.length ? null : { ...blankDraft },
  );
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const refresh = () => setProfiles(getProfiles());

  function newProfile() {
    setResult(null);
    setDraft({ ...blankDraft });
  }

  function edit(p: Profile) {
    setResult(null);
    setDraft(toDraft(p));
  }

  function remove(id: string) {
    deleteProfile(id);
    refresh();
    setDraft(null);
  }

  function connect(p: Profile) {
    setActiveId(p.id);
    onConnected();
  }

  async function test() {
    if (!draft) return;
    setTesting(true);
    setResult(null);
    try {
      const r = await api<TestConnectionResult>(
        'test_connection',
        {},
        {
          conn: {
            host: draft.host,
            port: Number(draft.port) || 3306,
            user: draft.user,
            pass: draft.pass,
          },
        },
      );
      setResult({ ok: true, msg: `Connected · MySQL ${r.version}` });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  function save(activate: boolean) {
    if (!draft) return;
    const saved = saveProfile({
      id: draft.id,
      name: draft.name.trim() || `${draft.user}@${draft.host}`,
      host: draft.host.trim(),
      port: Number(draft.port) || 3306,
      user: draft.user.trim(),
      pass: draft.pass,
      remember: draft.remember,
    });
    refresh();
    if (activate) connect(saved);
    else setDraft(null);
  }

  const canDismiss = dismissable;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md"
      onClick={() => canDismiss && onClose()}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-outline-variant px-lg py-md">
          <div className="flex items-center gap-sm">
            <Database className="text-primary" size={20} />
            <h2 className="font-display text-lg font-semibold text-on-surface">
              Connections
            </h2>
          </div>
          {canDismiss && (
            <button
              onClick={onClose}
              className="rounded-lg p-xs text-on-surface-variant hover:bg-surface-container-high"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div className="grid grid-cols-[260px_1fr] divide-x divide-outline-variant">
          {/* Profile list */}
          <aside className="max-h-[60vh] overflow-y-auto p-sm">
            {profiles.length === 0 && (
              <p className="px-sm py-md text-sm text-on-surface-variant">
                No saved connections yet.
              </p>
            )}
            <ul className="space-y-xs">
              {profiles.map((p) => (
                <li
                  key={p.id}
                  className="group flex items-center justify-between rounded-lg px-sm py-sm hover:bg-surface-container-high"
                >
                  <button
                    onClick={() => connect(p)}
                    className="min-w-0 flex-1 text-left"
                    title="Connect"
                  >
                    <div className="truncate text-sm font-medium text-on-surface">
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-on-surface-variant">
                      {p.user}@{p.host}:{p.port}
                    </div>
                  </button>
                  <div className="flex items-center gap-xs opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => edit(p)}
                      className="rounded p-xs text-on-surface-variant hover:bg-surface-container-highest"
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded p-xs text-error hover:bg-surface-container-highest"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              onClick={newProfile}
              className="mt-sm flex w-full items-center gap-sm rounded-lg border border-dashed border-outline-variant px-sm py-sm text-sm text-on-surface-variant hover:bg-surface-container-high"
            >
              <Plus size={16} /> New connection
            </button>
          </aside>

          {/* Editor */}
          <section className="p-lg">
            {!draft ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-on-surface-variant">
                <Database size={32} className="mb-sm opacity-50" />
                <p className="text-sm">Select a connection to edit, or create one.</p>
              </div>
            ) : (
              <form
                className="space-y-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(true);
                }}
              >
                <Field label="Name (optional)">
                  <input
                    className={inputCls}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Local MySQL"
                  />
                </Field>
                <div className="grid grid-cols-[1fr_120px] gap-md">
                  <Field label="Host">
                    <input
                      className={inputCls}
                      value={draft.host}
                      onChange={(e) => setDraft({ ...draft, host: e.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Port">
                    <input
                      className={inputCls}
                      value={draft.port}
                      onChange={(e) => setDraft({ ...draft, port: e.target.value })}
                      inputMode="numeric"
                    />
                  </Field>
                </div>
                <Field label="User">
                  <input
                    className={inputCls}
                    value={draft.user}
                    onChange={(e) => setDraft({ ...draft, user: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Password">
                  <input
                    className={inputCls}
                    type="password"
                    name="password"
                    autoComplete="off"
                    value={draft.pass}
                    onChange={(e) => setDraft({ ...draft, pass: e.target.value })}
                    placeholder="••••••"
                  />
                </Field>
                <label className="flex items-center gap-sm text-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={draft.remember}
                    onChange={(e) => setDraft({ ...draft, remember: e.target.checked })}
                    className="accent-primary"
                  />
                  Remember password (stored in this browser)
                </label>

                {result && (
                  <div
                    className={`rounded-lg px-md py-sm text-sm ${
                      result.ok
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-error/10 text-error'
                    }`}
                  >
                    {result.msg}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-sm pt-xs">
                  <button
                    type="button"
                    onClick={test}
                    disabled={testing}
                    className="flex items-center gap-sm rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high disabled:opacity-60"
                  >
                    {testing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => save(false)}
                    className="rounded-lg border border-outline-variant px-md py-sm text-sm text-on-surface hover:bg-surface-container-high"
                  >
                    Save
                  </button>
                  <button
                    type="submit"
                    className="ml-auto rounded-lg bg-primary px-lg py-sm text-sm font-medium text-on-primary hover:opacity-90"
                  >
                    Save & Connect
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-sm text-on-surface outline-none focus:border-primary';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-xs block text-xs font-medium text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}

// Re-export so callers building a quick conn can reuse the helper.
export { connFor };
