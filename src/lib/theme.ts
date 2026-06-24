// Theme: Light / Dark / System. Pre-paint application lives inline in index.html
// (must run before first paint). This module handles runtime switching.

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'strata-theme';
const mql = window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): ThemeMode {
  return (localStorage.getItem(KEY) as ThemeMode) || 'system';
}

export function applyTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && mql.matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem(KEY, mode);
  applyTheme(mode);
}

// Apply on module load. Standalone already ran the pre-paint script in
// index.html; WP has no such entry, so this is the only thing that themes
// the SPA before the user touches the toggle.
applyTheme(getTheme());

// Re-apply on OS change while in system mode.
mql.addEventListener('change', () => {
  if (getTheme() === 'system') applyTheme('system');
});
