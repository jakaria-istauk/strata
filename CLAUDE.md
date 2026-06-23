# CLAUDE.md — Strata

Project context for Claude Code. Read this first.

## What this is

**Strata** — a modern, self-hosted MySQL admin client. Custom UI over a thin PHP+PDO JSON API. A full UI replacement for Adminer (not a theme). Vanilla JS + Tailwind front-end, no framework.

- Product spec: [docs/PRD.md](docs/PRD.md)
- Phased build plan: [docs/PLAN.md](docs/PLAN.md) — **check current phase before starting work**
- User: linkon@wpdeveloper.com

## Stack & layout

- PHP 8.x + `pdo_mysql` (no Composer deps).
- Front-end: vanilla JS + Tailwind (CDN in dev). No build step required.
- All app state (connection profiles, theme, history) lives in browser **localStorage** — no server config file.

```
index.html         app shell + Explorer screen markup (no inline app JS)
api.php            stateless JSON gateway (PDO)
assets/            strata.css (theme tokens) + strata.js (app logic)
docs/              PRD.md, PLAN.md — source of truth for scope/sequencing
README.md          install / run / security
legacy/            old Adminer build (gitignored, reference only)
ui/                design mockups (gitignored, reference only)
```

Served from repo **root**. App at `/`, API at `/api.php`.

## Run & verify

```bash
# Herd-independent: plain PHP server
php -S 127.0.0.1:8899        # then open http://127.0.0.1:8899/
# Or via Herd: http://adminer.test/
```

- Smoke-test API: `curl "http://adminer.test/api.php?action=databases"`
- Lint PHP: `php -l api.php`
- Visual verify: use chrome-devtools MCP (navigate → evaluate to pick db/table → screenshot → check console).

### Local DB (dev)
Herd MySQL on `127.0.0.1:3306`, user `root`, no password. `wp` DB has real tables (e.g. `wp_users`) good for testing. `assetrail` is empty — don't use it for grid tests.

## API contract (`api.php?action=…`)

| action | params | returns |
|---|---|---|
| `databases` | — | `{databases:[]}` |
| `tables` | `db` | `{tables:[{name,rows,type,engine,size}]}` |
| `columns` | `db,table` | `{columns:[{name,type,key,nullable,default,extra}]}` |
| `rows` | `db,table,page,per_page,sort,dir,search` | `{columns,rows,total,page,pages,…}` |
| `test_connection` | (creds only) | `{ok,version,host}` |
| `row_get` | `db,table,pk{}` | `{columns,row}` |
| `row_save` | `db,table,values{}[,pk{}]` | `{ok,mode,affected\|insertId}` (pk present ⇒ update, absent ⇒ insert) |
| `row_delete` | `db,table,pks[{}]` | `{ok,deleted}` (transactional) |
| `export_csv` | `db,table,search,sort,dir` | streamed `text/csv` (all matching rows) |
| `stats` | `db` | `{version,uptime,dbCount,tableCount,dbSize,threads*,questions,slowQueries,bytes*,breakdown}` |
| `query` | `db,sql` | `{type:'result',columns,rows,rowCount,ms}` or `{type:'exec',affected,ms}` |

Every request is **POST** with a JSON body `{conn:{host,port,user,pass,db?}, ...params}`.
`conn` carries the active profile's creds (api.php reads them there; no hardcoded creds).
Action stays in the query string. Params may be in the query string or the body.

All planned API actions implemented.

## Conventions / guardrails

- **SQL safety:** db/table/column identifiers are NEVER trusted from input — validate against `information_schema` before backtick-interpolating (`assertDb`/`assertTable`/`columnsOf` in api.php). Values always use bound params.
- **Errors:** every API error returns JSON `{error}` + HTTP status. UI must show inline, never a blank grid.
- **Creds:** DB creds are sent per-request from the client (localStorage profiles) in the JSON body `conn`. `api.php` is stateless — no hardcoded creds. Passwords persist only when "Remember password" is on; otherwise kept in-memory and re-prompted on reload.
- **Theming (Phase 1):** target is CSS-variable tokens with Light/Dark/System modes. Current index.html is dark-only hardcoded — don't add more hardcoded colors; migrate to tokens.
- **Keep it vanilla:** no SPA framework. Split JS into modules under `assets/` only if it grows.

## Git

- Branch `main`. Commit when the user asks. Author: linkon <linkon@wpdeveloper.com>.
- `ui/` and `legacy/` are gitignored (reference only). Don't re-add them.
- The large `.zip` is gitignored.

## Status

Phase 0 (Explorer) ✅. Phase 1 (Strata rebrand + theming) ✅. Phase 2 (Connection Settings — localStorage profiles, stateless creds) ✅. Phase 3 (Row CRUD) ✅. Phase 4 (SQL Editor) ✅. Phase 5 (Dashboard) ✅. Phase 6 (Polish — FK links, column show/hide, full CSV export, shortcuts) ✅ (Tailwind CLI build deferred).
