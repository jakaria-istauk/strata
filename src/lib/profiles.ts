// Connection profiles — localStorage source of truth. api.php is stateless;
// the active profile's creds ride every request in body `conn`.
//
// Passwords persist to localStorage only when `remember` is on. Otherwise the
// password is kept in this module's in-memory map and re-prompted on reload.

import type { Conn, Profile } from '../types';

const PROFILES_KEY = 'strata-profiles';
const ACTIVE_KEY = 'strata-active-profile';

// Runtime-only passwords for profiles with remember=false (cleared on reload).
const sessionPass = new Map<string, string>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getProfiles(): Profile[] {
  return read<Profile[]>(PROFILES_KEY, []);
}

function writeProfiles(list: Profile[]) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
}

export function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function getActiveProfile(): Profile | null {
  const id = getActiveId();
  if (!id) return null;
  return getProfiles().find((p) => p.id === id) ?? null;
}

function genId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

/** Add or update a profile. `pass` persists only when `remember`; else cached in-memory. */
export function saveProfile(
  input: Omit<Profile, 'id'> & { id?: string; pass?: string },
): Profile {
  const list = getProfiles();
  const id = input.id ?? genId();
  const { pass, ...rest } = input;

  const profile: Profile = {
    ...rest,
    id,
    pass: input.remember ? pass : undefined,
  };

  if (pass !== undefined) {
    if (input.remember) sessionPass.delete(id);
    else sessionPass.set(id, pass);
  }

  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) list[idx] = profile;
  else list.push(profile);
  writeProfiles(list);
  return profile;
}

export function deleteProfile(id: string) {
  writeProfiles(getProfiles().filter((p) => p.id !== id));
  sessionPass.delete(id);
  if (getActiveId() === id) setActiveId(null);
}

/** In-memory password for a non-remembered profile (set after a prompt). */
export function setSessionPassword(id: string, pass: string) {
  sessionPass.set(id, pass);
}

/** Resolve the effective password: persisted (remember) else in-memory. */
export function getPassword(profile: Profile): string | undefined {
  if (profile.remember) return profile.pass ?? '';
  return sessionPass.get(profile.id);
}

/** True when a non-remembered active profile has no in-memory password yet. */
export function needsPassword(profile: Profile): boolean {
  return getPassword(profile) === undefined;
}

/** Build the `conn` object for the active profile (creds for api.php). */
export function connFor(profile: Profile, db?: string): Conn {
  return {
    host: profile.host,
    port: profile.port,
    user: profile.user,
    pass: getPassword(profile) ?? '',
    ...(db ? { db } : {}),
  };
}

/** Active connection for the current profile, or null if none / locked. */
export function activeConn(db?: string): Conn | null {
  const p = getActiveProfile();
  if (!p || needsPassword(p)) return null;
  return connFor(p, db);
}
