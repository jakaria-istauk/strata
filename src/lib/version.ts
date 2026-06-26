// Semantic-version compare for the standalone update check. Handles a leading
// v/V and dotted numeric cores; pre-release/build suffixes are ignored (a
// dash or plus and everything after). Returns -1 / 0 / 1 (a<b / a==b / a>b).

function parse(v: string): number[] {
  const core = v.trim().replace(/^[vV]/, '').split(/[-+]/)[0];
  return core.split('.').map((n) => {
    const x = parseInt(n, 10);
    return Number.isFinite(x) ? x : 0;
  });
}

export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

/** True when `latest` is a strictly newer release than `current`. */
export function isNewer(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0;
}
