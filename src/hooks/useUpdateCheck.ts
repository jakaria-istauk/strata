// Standalone update check — the non-WP analogue of the plugin updater.
// Polls GitHub's "latest release" for jakaria-istauk/strata, compares the tag
// to the bundled __APP_VERSION__, and reports whether a newer build exists.
// The standalone app is static files + api.php, so it can't self-install; this
// only *notifies* (the sidebar badge links to the release to download).
//
// The result is cached in localStorage for 12h so a reload doesn't re-hit the
// GitHub API. Skipped entirely under WordPress (the plugin owns updates there).

import { useEffect, useState } from 'react';
import { IS_WP } from '../lib/wp';
import { isNewer } from '../lib/version';

const REPO = 'jakaria-istauk/strata';
const CACHE_KEY = 'strata-update-check';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

interface Cache {
  checkedAt: number;
  latest: string; // tag without leading v
  url: string;
}

export interface UpdateInfo {
  /** A strictly newer release is available. */
  available: boolean;
  /** Latest release version (no leading v), when known. */
  latest: string | null;
  /** Release page URL to view/download. */
  url: string;
}

const CURRENT = __APP_VERSION__;

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cache;
    if (!c || typeof c.checkedAt !== 'number') return null;
    return c;
  } catch {
    return null;
  }
}

export function useUpdateCheck(): UpdateInfo {
  const [info, setInfo] = useState<UpdateInfo>({ available: false, latest: null, url: '' });

  useEffect(() => {
    if (IS_WP) return;

    const cached = readCache();
    if (cached) {
      setInfo({
        available: isNewer(cached.latest, CURRENT),
        latest: cached.latest,
        url: cached.url,
      });
      if (Date.now() - cached.checkedAt < TTL_MS) return; // fresh enough
    }

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { tag_name?: string; html_url?: string };
        if (!data.tag_name) return;
        const latest = data.tag_name.replace(/^[vV]/, '');
        const url = data.html_url ?? `https://github.com/${REPO}/releases`;
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ checkedAt: Date.now(), latest, url } satisfies Cache),
          );
        } catch { /* storage full / disabled — non-fatal */ }
        setInfo({ available: isNewer(latest, CURRENT), latest, url });
      } catch {
        /* offline / rate-limited — stay on cached or no-update state */
      }
    })();

    return () => ctrl.abort();
  }, []);

  return info;
}
