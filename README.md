# Strata

A modern, self-hosted database admin client — custom UI over a thin PHP+PDO JSON API. A full UI replacement for Adminer, not a theme.

> Status: feature-complete through Phase 5. See [docs/PLAN.md](docs/PLAN.md) and [docs/PRD.md](docs/PRD.md).

## Features

- **Data Browser** — databases + tables sidebar, sortable/searchable/paginated grid, foreign-key links, per-table column show/hide, full-table CSV export.
- **Row CRUD** — slide-in drawer to view/edit/insert rows; type-aware inputs, NULL toggles, locked PK/auto-increment; single + bulk delete.
- **Query Runner** — run arbitrary SQL with multiple tabs and history; Run (⌘/Ctrl+Enter) and Explain; results grid with timing.
- **Dashboard** — live server metrics (connections, uptime, queries, slow queries, DB/table counts + size) and a query-type breakdown.
- **Theming** — Light / Dark / System, persisted, applied before first paint.
- **Connections** — multiple localStorage profiles, active-profile switcher, test-connection, optional remember-password.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus the row search |
| `n` | New row (Data Browser) |
| `⌘/Ctrl + Enter` | Run query (Query Runner) |
| `Esc` | Close drawer / modal / menus |

## Run

Requires PHP 8.x with `pdo_mysql` and a reachable MySQL/MariaDB.

```bash
php -S 127.0.0.1:8899
# open http://127.0.0.1:8899/
```

Or serve the folder with Herd / Apache / nginx+fpm.

## Connection

Connection details (host, port, user, password) are configured in the in-app Settings and stored in your browser's localStorage — nothing is hardcoded server-side.

**Security:** credentials are stored in plaintext in localStorage and sent from the browser to `api.php` on each request. Run on localhost or behind HTTPS. Do not expose to untrusted networks.

## Docs

- [docs/PRD.md](docs/PRD.md) — product requirements
- [docs/PLAN.md](docs/PLAN.md) — phased implementation plan
- `ui/` — design mockups (reference)
