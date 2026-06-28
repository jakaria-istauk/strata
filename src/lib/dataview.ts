// Read-only "rich cell" detection + beautify helpers used by the data grid.
// Three kinds get special view treatment:
//   - json  → pretty-printed JSON
//   - php   → PHP serialize() blobs, parsed then pretty-printed
//   - datetime → date/time columns, formatted in a chosen timezone
// Everything here is best-effort: detectors are cheap and beautifiers return
// `undefined` on anything they can't parse, so callers fall back to raw text.

import type { Column } from '../types';

export type RichKind = 'json' | 'php' | 'datetime';

const DATE_TYPES = new Set(['datetime', 'timestamp', 'date', 'time', 'year']);

/**
 * Classify a cell by column type + value. Null/empty/non-string values are
 * never rich (numeric columns arrive as JS numbers, not strings).
 */
export function detectKind(col: Column, value: unknown): RichKind | null {
  if (typeof value !== 'string' || value === '') return null;
  if (DATE_TYPES.has(col.type.toLowerCase())) return 'datetime';
  if (col.type.toLowerCase() === 'json' || looksJson(value)) return 'json';
  if (looksPhp(value)) return 'php';
  return null;
}

// --- JSON -------------------------------------------------------------------

export function looksJson(s: string): boolean {
  const t = s.trim();
  return (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  );
}

/** Parse + re-stringify with 2-space indent. `undefined` if not valid JSON. */
export function beautifyJson(s: string): string | undefined {
  try {
    return JSON.stringify(JSON.parse(s.trim()), null, 2);
  } catch {
    return undefined;
  }
}

// --- PHP serialize() --------------------------------------------------------

const PHP_RE = /^(N;|b:[01];|i:-?\d+;|d:[^;]*;|s:\d+:"|a:\d+:\{|O:\d+:")/;
export function looksPhp(s: string): boolean {
  return PHP_RE.test(s.trim());
}

/**
 * Minimal recursive-descent parser for PHP's serialize() format.
 * Handles N b i d s a (array) and O (object). Sequential 0..n-1 integer-keyed
 * arrays decode to JS arrays; everything else to plain objects (O keeps its
 * class name under `__class__`). Returns `undefined` on malformed input.
 */
export function phpUnserialize(input: string): unknown | undefined {
  // PHP's `s:<n>:"…"` counts n in BYTES, not characters. Parse over the UTF-8
  // byte stream so multibyte content (emoji, accented text, …) stays in sync.
  const bytes = new TextEncoder().encode(input.trim());
  const decoder = new TextDecoder();
  let i = 0;
  const fail = (): never => {
    throw new Error('php parse error');
  };
  const at = (k: number) => String.fromCharCode(bytes[k]); // structural bytes are ASCII
  const expect = (ch: string) => {
    if (bytes[i] !== ch.charCodeAt(0)) fail();
    i++;
  };
  const readUntil = (ch: string): string => {
    const target = ch.charCodeAt(0);
    let j = i;
    while (j < bytes.length && bytes[j] !== target) j++;
    if (j >= bytes.length) fail();
    const out = decoder.decode(bytes.subarray(i, j));
    i = j + 1;
    return out;
  };
  const readString = (): string => {
    const len = parseInt(readUntil(':'), 10); // byte length
    expect('"');
    const out = decoder.decode(bytes.subarray(i, i + len));
    i += len;
    expect('"');
    return out;
  };
  function value(): unknown {
    switch (at(i)) {
      case 'N':
        i += 2; // N;
        return null;
      case 'b': {
        i += 2; // b:
        const v = bytes[i] === 0x31; // '1'
        i += 2; // 1;
        return v;
      }
      case 'i':
        i += 2; // i:
        return parseInt(readUntil(';'), 10);
      case 'd':
        i += 2; // d:
        return parseFloat(readUntil(';'));
      case 's': {
        i += 2; // s:
        const out = readString();
        expect(';');
        return out;
      }
      case 'a': {
        i += 2; // a:
        const count = parseInt(readUntil(':'), 10);
        expect('{');
        const obj: Record<string, unknown> = {};
        let sequential = true;
        for (let k = 0; k < count; k++) {
          const key = value();
          obj[String(key)] = value();
          if (key !== k) sequential = false;
        }
        expect('}');
        return sequential ? Object.values(obj) : obj;
      }
      case 'O': {
        i += 2; // O:
        const cls = readString(); // class name
        expect(':');
        const count = parseInt(readUntil(':'), 10);
        expect('{');
        const obj: Record<string, unknown> = { __class__: cls };
        for (let k = 0; k < count; k++) {
          const key = value();
          obj[String(key)] = value();
        }
        expect('}');
        return obj;
      }
      default:
        return fail();
    }
  }
  try {
    return value();
  } catch {
    return undefined;
  }
}

/** Parse a PHP blob and pretty-print it as JSON. `undefined` on failure. */
export function beautifyPhp(s: string): string | undefined {
  const v = phpUnserialize(s);
  if (v === undefined) return undefined;
  return JSON.stringify(v, null, 2);
}

// --- Date / time ------------------------------------------------------------

export interface TzOption {
  value: string; // '' = browser local, otherwise a fixed offset in minutes
  label: string;
}

/** Format a signed minute offset as `UTC±HH:MM`. */
function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

// Local + every fixed offset from UTC-12:00 to UTC+14:00 in 30-minute steps.
export const TZ_OPTIONS: TzOption[] = [
  { value: '', label: 'Local' },
  ...Array.from({ length: (14 * 60 - -12 * 60) / 30 + 1 }, (_, i) => {
    const minutes = -12 * 60 + i * 30;
    return { value: String(minutes), label: offsetLabel(minutes) };
  }),
];

/**
 * Parse a MySQL date/time string as an instant. Stored values are naive
 * (no zone), so we interpret them as UTC — the viewer then re-projects into a
 * chosen display zone. Returns null when the value isn't a full date(+time).
 */
function parseAsUtc(raw: string): Date | null {
  const m = raw
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', se = '0'] = m;
  const t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  return Number.isNaN(t) ? null : new Date(t);
}

export interface DateView {
  formatted: string; // full localized date+time in the chosen zone
  offset: string; // e.g. "UTC+06:00"
  relative: string; // e.g. "3 days ago"
}

/**
 * Format a stored date/time for display. `tz` is '' (browser local) or a fixed
 * offset in minutes — fixed offsets are applied by shifting the instant and
 * rendering in UTC, since Intl `timeZone` can't express 30-minute offsets.
 */
export function formatDateTime(raw: string, tz: string, now: number): DateView | null {
  const dt = parseAsUtc(raw);
  if (!dt) return null;

  if (tz === '') {
    const formatted = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(dt);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'longOffset',
    }).formatToParts(dt);
    const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
    return { formatted, offset, relative: relativeTime(dt.getTime() - now) };
  }

  const minutes = Number(tz);
  const shifted = new Date(dt.getTime() + minutes * 60_000);
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(shifted);
  return {
    formatted,
    offset: offsetLabel(minutes),
    relative: relativeTime(dt.getTime() - now),
  };
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1000],
];

function relativeTime(deltaMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= ms || unit === 'second') {
      return rtf.format(Math.round(deltaMs / ms), unit);
    }
  }
  return 'now';
}
