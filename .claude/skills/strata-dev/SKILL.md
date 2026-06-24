---
name: strata-dev
description: Run, smoke-test, and visually verify the Strata DB admin app. Use when working on Strata (React/TS front-end or api.php), starting the dev server, testing API actions, or confirming a UI change renders against live MySQL.
---

# Strata — Dev & Verify

Strata is a **React 18 + TypeScript + Vite + Tailwind** SPA (`src/`, `index.html`) over a thin PHP+PDO JSON API (`api.php`). Front-end builds to `dist/`; `strata.test` is `herd link`ed to `dist/`. Full context: [CLAUDE.md](../../../CLAUDE.md), [PLAN.md](../../../PLAN.md).

## Before coding
1. Read [PLAN.md](../../../PLAN.md) — confirm which phase the requested work belongs to and what's already done.
2. Respect guardrails in [CLAUDE.md](../../../CLAUDE.md): identifier whitelisting, JSON `{error}` responses, no hardcoded colors (use tokens), creds model, TanStack Query for server state.

## Run
```bash
npm run dev                             # Vite :5173, proxies /api.php → http://strata.test
npm run build                           # tsc -b + Vite → dist/ (api.php copied in)
php -l api.php                          # lint backend before serving
# http://strata.test/ serves dist/ — refresh only after npm run build
```
Type-check = `npm run build` (runs `tsc -b`). Use `http://` not `https://` (no SSL on the link).

## Smoke-test the API (no browser)
Every request is **POST** with a JSON `{conn:{...}, ...params}` body:
```bash
curl -s -X POST "http://strata.test/api.php?action=databases" \
  -H 'Content-Type: application/json' \
  -d '{"conn":{"host":"127.0.0.1","port":3306,"user":"root","pass":""}}'
curl -s -X POST "http://strata.test/api.php?action=tables" \
  -H 'Content-Type: application/json' \
  -d '{"conn":{"host":"127.0.0.1","port":3306,"user":"root","pass":""},"db":"wp"}'
```
Use DB `wp` (real data, e.g. `wp_users`). Avoid `assetrail` (empty).

## Visual verify (chrome-devtools MCP)
1. `new_page` → `http://localhost:5173/` (dev) or `http://strata.test/` (built).
2. Drive through the **real UI** — `click`/`fill` on rendered components (DbSelect, TableList links, grid headers, RowDrawer). Don't inject DOM; React owns it.
3. `take_screenshot` — confirm grid renders real rows, PK key icon, NULL/badge styling, pagination.
4. `list_console_messages` (types: error,warn) — expect a clean console; any error/warn is a regression (fonts, Tailwind, icons all self-hosted — no CDN warnings).

## Done means
- `tsc -b` clean (via `npm run build`), `php -l` clean, API returns expected JSON, grid renders live data, console has no new errors.
- If the change is user-facing, `npm run build` then screenshot it before reporting done.
