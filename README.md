# Strata

A modern, self-hosted MySQL admin client — a React single-page app over a thin PHP + PDO JSON API.

React 18 + TypeScript + Vite + Tailwind front-end (TanStack Query + React Router). All app state (connection profiles, theme, query history, per-column formats, hidden columns) lives in your browser's `localStorage`; the PHP backend is stateless and holds no credentials.

> Status: feature-complete. See [docs/PRD.md](docs/PRD.md) and [docs/PLAN.md](docs/PLAN.md).

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
- **Row CRUD** — slide-in drawer to view / edit / insert rows; per-field NULL toggles, locked auto-increment columns, optional per-column server-side hashing (md5/sha1/sha256); single and bulk delete (transactional).
- **Schema ops** — create / drop databases, create tables with a column builder, alter table (rename/retype/null/AI, add & drop columns), drop tables — all destructive actions are type-to-confirm.
- **SQL editor** — run arbitrary SQL with ⌘/Ctrl+Enter; result grid vs affected-rows, timing, and a `localStorage` query history.
- **Dashboard** — live server metrics (connections, uptime, questions, slow queries, DB / table counts and size) plus a query-type breakdown.
- **Theming** — Light / Dark / System modes, persisted, applied before first paint (no flash).
- **Connections** — multiple `localStorage` profiles, active-profile switcher, test-connection, optional remember-password.

## Requirements

- PHP 8.x with the `pdo_mysql` extension (no Composer dependencies).
- A reachable MySQL or MariaDB server.
- Node 18+ / npm to build the front-end (not needed to run a prebuilt bundle).

## Quick start

```bash
npm install
npm run dev      # Vite dev server on :5173, proxies /api.php → http://strata.test
```

For a production build:

```bash
npm run build    # → dist/ (index.html + hashed assets + api.php copied in)
```

Serve `dist/` with **Herd** (`http://strata.test/`), Apache, or nginx + php-fpm so the SPA and `api.php` are same-origin. To share a self-contained bundle:

```bash
make zip         # → strata.zip of dist/; recipient needs only PHP:
                 #   unzip strata.zip -d strata && cd strata && php -S 127.0.0.1:8000
```

On first load, open **Connections**, add a profile (host, port, user, password), test it, and save. Pick a database from the sidebar to start browsing.

## Architecture

```
Browser (React SPA)                         PHP backend
┌─────────────────────────────┐             ┌──────────────────────┐
│ React + TS + Vite + Tailwind │  POST       │ api.php              │
│ TanStack Query · React Router│ ─────────►  │  stateless gateway   │
│ localStorage  profiles/theme │  JSON body  │  PDO → MySQL/MariaDB  │
│                              │ ◄─────────  │  JSON / CSV response  │
└─────────────────────────────┘             └──────────────────────┘
```

- Every API call is a **POST** to `api.php?action=<name>`. The action stays in the query string; params and the `conn` credentials object travel in the JSON body.
- `api.php` is **stateless** — it reads connection credentials from the request body each time. Nothing is stored server-side.
- All identifiers (db / table / column) are validated against `information_schema` before being backtick-interpolated; all values use bound parameters.

## Project layout

```
index.html         Vite entry (pre-paint theme script + #root)
api.php            stateless JSON gateway (PDO)
vite.config.ts  tailwind.config.ts  tsconfig*.json  postcss.config.js
public/
  assets/strata-logo.png   brand mark / favicon
  fonts/                   self-hosted Inter / Geist / JetBrains Mono woff2
src/
  main.tsx index.css       mount (QueryClient + Router) + Tailwind/tokens/@font-face
  api.ts  types.ts         typed gateway wrapper + API contract types
  lib/  hooks/  routes/  components/
docs/
  PRD.md  PLAN.md          product requirements + phased plan
dist/              build output (gitignored) — what you deploy
README.md  CLAUDE.md  Makefile
```

## Connections & credentials

Connection details (host, port, user, password, optional default db) are configured in the in-app **Connections** dialog and stored as profiles in your browser's `localStorage`. Nothing is hardcoded server-side.

On each request the active profile's credentials are sent to `api.php` in the JSON body under `conn`:

```json
{ "conn": { "host": "127.0.0.1", "port": 3306, "user": "root", "pass": "", "db": "wp" } }
```

Passwords persist in `localStorage` only when **Remember password** is enabled. Otherwise the password is kept in memory and re-prompted on reload.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the row search (Data Browser) |
| `n` | New row (Data Browser) |
| `e` | Export CSV (Data Browser) |
| `⌘/Ctrl + Enter` | Run query (SQL editor) |
| `Esc` | Close drawer / modal / menus |

## API reference

All requests are **POST** to `api.php?action=<name>`. The body is JSON: `{ "conn": { … }, …params }`. Params may also be supplied in the query string (the body wins on conflict). Errors return `{ "error": "<message>" }` with an appropriate HTTP status.

| action | params | returns |
|---|---|---|
| `test_connection` | (creds only) | `{ok, version, host}` |
| `databases` | — | `{databases:[]}` |
| `create_database` | `name` | `{ok, name}` |
| `drop_database` | `db` | `{ok, dropped}` |
| `tables` | `db` | `{tables:[{name,rows,type,engine,size}]}` |
| `create_table` | `db, name, columns[{name,type,nullable,auto_increment,pk}]` | `{ok, db, name}` |
| `alter_table` | `db, table, ops[{op,orig?,name,type,…}]` | `{ok, altered}` |
| `drop_table` | `db, table` | `{ok, dropped}` |
| `columns` | `db, table` | `{columns:[{name,type,coltype,key,nullable,default,extra}]}` |
| `rows` | `db, table, page, per_page, sort, dir, search` | `{columns, rows, fks, total, page, pages, …}` |
| `row_get` | `db, table, pk{}` | `{columns, row}` |
| `row_save` | `db, table, values{} [, pk{}] [, transforms{}]` | `{ok, mode, affected\|insertId}` — `pk` present ⇒ update, absent ⇒ insert |
| `row_delete` | `db, table, pks[{}]` | `{ok, deleted}` (transactional) |
| `export_csv` | `db, table, search, sort, dir` | streamed `text/csv` (all matching rows) |
| `query` | `db, sql` | `{type:'result', columns, rows, rowCount, ms}` or `{type:'exec', affected, ms}` |
| `stats` | `db` | `{version, uptime, dbCount, tableCount, dbSize, threadsConnected, threadsRunning, questions, slowQueries, bytesSent, bytesReceived, breakdown}` |

Pagination caps: `per_page` defaults to 50, max 500.

### Example

```bash
curl -s "http://strata.test/api.php?action=tables" \
  -H 'Content-Type: application/json' \
  -d '{"conn":{"host":"127.0.0.1","port":3306,"user":"root","pass":""},"db":"wp"}'
```

## Security

- Credentials are stored in **plaintext** in `localStorage` and sent from the browser to `api.php` on every request.
- Run on **localhost** or behind **HTTPS**. Do not expose to untrusted networks.
- SQL identifiers are validated against `information_schema`; values are always bound. The `query` action runs arbitrary SQL with the connecting user's privileges — restrict the DB user accordingly.
- `api.php` emits JSON-only errors (never a blank grid).

## Development

```bash
npm run dev                                     # Vite dev server (:5173)
npm run build                                   # type-check (tsc -b) + build → dist/
php -l api.php                                   # lint the backend
curl "http://strata.test/api.php?action=databases"   # smoke-test (Herd)
```

Conventions:

- **No CDN** — icons via lucide-react; fonts self-hosted in `public/fonts/`.
- **No hardcoded colors** — use the CSS-variable theme tokens in `src/index.css`, mapped to Tailwind classes in `tailwind.config.ts`.
- **Server state** — TanStack Query for all db/table/row fetching; URL (React Router) holds active db/table + page/sort/search. Keep `src/api.ts` the single typed entry to `api.php`.
- **SQL safety** — never trust db/table/column names from input; validate against schema (`assertDb` / `assertTable` / `columnsOf` in `api.php`) before interpolating.

### Local dev database

Herd MySQL on `127.0.0.1:3306`, user `root`, no password. The `wp` database has real tables (e.g. `wp_users`) suitable for grid testing.

## Troubleshooting

- **No active connection** — open Connections and configure/activate a profile.
- **"DB connection failed"** — check host/port/user/password and that MySQL is running and reachable.
- **`strata.test` shows a stale UI** — the linked folder is `dist/`; re-run `npm run build`.
- **Password keeps re-prompting** — enable *Remember password* on the profile (stores it in `localStorage`).

## Docs

- [docs/PRD.md](docs/PRD.md) — product requirements
- [docs/PLAN.md](docs/PLAN.md) — phased implementation plan
- [CLAUDE.md](CLAUDE.md) — project context and guardrails
