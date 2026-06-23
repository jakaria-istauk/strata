# Strata

A modern, self-hosted MySQL admin client — a custom UI over a thin PHP + PDO JSON API.

Vanilla JS + Tailwind front-end, no framework, no build step. All app state (connection profiles, theme, query history) lives in your browser's `localStorage`; the PHP backend is stateless and holds no credentials.

> Status: feature-complete through Phase 6. See [docs/PRD.md](docs/PRD.md) and [docs/PLAN.md](docs/PLAN.md).

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Connections & credentials](#connections--credentials)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [API reference](#api-reference)
- [Security](#security)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Docs](#docs)

## Features

- **Data Browser** — databases + tables sidebar, sortable / searchable / paginated grid, foreign-key links, per-table column show/hide, full-table CSV export.
- **Row CRUD** — slide-in drawer to view / edit / insert rows; type-aware inputs, NULL toggles, locked PK / auto-increment columns; single and bulk delete (transactional).
- **Query Runner** — run arbitrary SQL with multiple tabs and history; Run (⌘/Ctrl+Enter) and Explain; results grid with row count and timing.
- **Dashboard** — live server metrics (connections, uptime, questions, slow queries, DB / table counts and size) plus a query-type breakdown.
- **Theming** — Light / Dark / System modes, persisted, applied before first paint (no flash).
- **Connections** — multiple `localStorage` profiles, active-profile switcher, test-connection, optional remember-password.

## Requirements

- PHP 8.x with the `pdo_mysql` extension (no Composer dependencies).
- A reachable MySQL or MariaDB server.
- A modern browser. Tailwind loads from CDN in dev; no build step required.

## Quick start

Served from the repo **root** — app at `/`, API at `/api.php`.

```bash
# Plain PHP built-in server (Herd-independent)
php -S 127.0.0.1:8899
# then open http://127.0.0.1:8899/
```

Or serve the folder with **Herd** (`http://strata.test/`), Apache, or nginx + php-fpm.

On first load, open **Settings**, add a connection profile (host, port, user, password), test it, and save. Pick a database from the sidebar to start browsing.

## Architecture

```
Browser (vanilla JS + Tailwind)            PHP backend
┌─────────────────────────────┐            ┌──────────────────────┐
│ index.html  app shell        │  POST      │ api.php              │
│ assets/strata.js  app logic  │ ─────────► │  stateless gateway   │
│ assets/strata.css  tokens    │  JSON body │  PDO → MySQL/MariaDB │
│ localStorage  profiles/theme │ ◄───────── │  JSON / CSV response │
└─────────────────────────────┘            └──────────────────────┘
```

- Every API call is a **POST** to `api.php?action=<name>`. The action stays in the query string; params and the `conn` credentials object travel in the JSON body.
- `api.php` is **stateless** — it reads connection credentials from the request body each time. Nothing is stored server-side.
- All identifiers (db / table / column) are validated against `information_schema` before being backtick-interpolated; all values use bound parameters.

## Project layout

```
index.html         app shell + Explorer screen markup (no inline app JS)
api.php            stateless JSON gateway (PDO)
assets/
  strata.js        all app logic (vanilla)
  strata.css       CSS-variable theme tokens (Light/Dark/System)
  strata-logo.png  brand mark / favicon
docs/
  PRD.md           product requirements
  PLAN.md          phased implementation plan
README.md          this file
CLAUDE.md          project context for Claude Code
```

## Connections & credentials

Connection details (host, port, user, password, optional default db) are configured in the in-app **Settings** and stored as profiles in your browser's `localStorage`. Nothing is hardcoded server-side.

On each request the active profile's credentials are sent to `api.php` in the JSON body under `conn`:

```json
{ "conn": { "host": "127.0.0.1", "port": 3306, "user": "root", "pass": "", "db": "wp" } }
```

Passwords persist in `localStorage` only when **Remember password** is enabled. Otherwise the password is kept in memory and re-prompted on reload.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the row search |
| `n` | New row (Data Browser) |
| `⌘/Ctrl + Enter` | Run query (Query Runner) |
| `Esc` | Close drawer / modal / menus |

## API reference

All requests are **POST** to `api.php?action=<name>`. The body is JSON: `{ "conn": { … }, …params }`. Params may also be supplied in the query string (the body wins on conflict). Errors return `{ "error": "<message>" }` with an appropriate HTTP status.

| action | params | returns |
|---|---|---|
| `test_connection` | (creds only) | `{ok, version, host}` |
| `databases` | — | `{databases:[]}` |
| `tables` | `db` | `{tables:[{name,rows,type,engine,size}]}` |
| `columns` | `db, table` | `{columns:[{name,type,key,nullable,default,extra}]}` |
| `rows` | `db, table, page, per_page, sort, dir, search` | `{columns, rows, fks, total, page, pages, …}` |
| `row_get` | `db, table, pk{}` | `{columns, row}` |
| `row_save` | `db, table, values{} [, pk{}]` | `{ok, mode, affected\|insertId}` — `pk` present ⇒ update, absent ⇒ insert |
| `row_delete` | `db, table, pks[{}]` | `{ok, deleted}` (transactional) |
| `export_csv` | `db, table, search, sort, dir` | streamed `text/csv` (all matching rows) |
| `query` | `db, sql` | `{type:'result', columns, rows, rowCount, ms}` or `{type:'exec', affected, ms}` |
| `stats` | `db` | `{version, uptime, dbCount, tableCount, dbSize, threadsConnected, threadsRunning, questions, slowQueries, bytesSent, bytesReceived, breakdown}` |

Pagination caps: `per_page` defaults to 50, max 500.

### Example

```bash
curl -s "http://127.0.0.1:8899/api.php?action=tables" \
  -H 'Content-Type: application/json' \
  -d '{"conn":{"host":"127.0.0.1","port":3306,"user":"root","pass":""},"db":"wp"}'
```

## Security

- Credentials are stored in **plaintext** in `localStorage` and sent from the browser to `api.php` on every request.
- Run on **localhost** or behind **HTTPS**. Do not expose to untrusted networks.
- SQL identifiers are validated against `information_schema`; values are always bound. The `query` action runs arbitrary SQL with the connecting user's privileges — restrict the DB user accordingly.
- `api.php` sets `X-Content-Type-Options: nosniff` and emits JSON-only errors (never a blank grid).

## Development

```bash
php -l api.php                                   # lint the backend
php -S 127.0.0.1:8899                            # run locally
curl "http://strata.test/api.php?action=databases"   # smoke-test (Herd)
```

Conventions:

- **Keep it vanilla** — no SPA framework. Split JS into modules under `assets/` only if it grows.
- **No hardcoded colors** — use the CSS-variable tokens in `assets/strata.css`.
- **SQL safety** — never trust db/table/column names from input; validate against schema (`assertDb` / `assertTable` / `columnsOf` in `api.php`) before interpolating.

### Local dev database

Herd MySQL on `127.0.0.1:3306`, user `root`, no password. The `wp` database has real tables (e.g. `wp_users`) suitable for grid testing.

## Troubleshooting

- **"No connection: send host/user…"** — open Settings and configure/activate a profile.
- **"DB connection failed"** — check host/port/user/password and that MySQL is running and reachable.
- **Blank Tailwind styling** — the CDN is unreachable; check your network or self-host Tailwind.
- **Password keeps re-prompting** — enable *Remember password* on the profile (stores it in `localStorage`).

## Docs

- [docs/PRD.md](docs/PRD.md) — product requirements
- [docs/PLAN.md](docs/PLAN.md) — phased implementation plan
- [CLAUDE.md](CLAUDE.md) — project context and guardrails
</content>
</invoke>
