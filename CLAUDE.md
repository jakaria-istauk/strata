# CLAUDE.md — Strata

Project context for Claude Code. Read this first.

## What this is

**Strata** — a modern, self-hosted MySQL admin client. **React SPA** front-end over a thin PHP+PDO JSON API.

- Product spec: [docs/PRD.md](docs/PRD.md)
- Phased build plan: [docs/PLAN.md](docs/PLAN.md) — **check current phase before starting work**
- User: linkon@wpdeveloper.com

## Stack & layout

- PHP 8.x + `pdo_mysql` (no Composer deps) — `api.php` is the stateless JSON gateway.
- Front-end: **React 18 + TypeScript + Vite + Tailwind v3**, TanStack Query + React Router. Icons: lucide-react (no CDN). Fonts: 3 self-hosted latin variable woff2 (no Google CDN).
- All app state (connection profiles, theme, history, formats) lives in browser **localStorage** — no server config file.

```
index.html            Vite entry: pre-paint theme script + <div id=root>
api.php               stateless JSON gateway (PDO) — unchanged
vite.config.ts  tailwind.config.ts  tsconfig*.json  postcss.config.js
public/
  assets/strata-logo.png
  fonts/              inter / geist / jetbrains-mono .woff2
src/
  main.tsx index.css  mount (QueryClient + Router) + Tailwind/tokens/@font-face
  api.ts types.ts     typed gateway wrapper + API contract types
  lib/ hooks/ routes/ components/
docs/                 PRD.md, PLAN.md — source of truth for scope/sequencing
dist/                 build output (gitignored) — strata.test serves this
README.md             install / run / security
```

## Run & verify

```bash
npm run dev            # Vite :5173, proxies /api.php → http://strata.test (uses Herd's PHP+MySQL)
npm run build          # → dist/ (index.html + hashed assets + api.php copied in)
make zip               # shareable dist/ bundle; recipient needs only PHP
```

- `strata.test` is `herd link`ed to **`dist/`** → updates only after `npm run build`. No SSL on the link → use `http://`, not `https://`.
- Smoke-test API: `curl -X POST "http://strata.test/api.php?action=databases" -H 'Content-Type: application/json' -d '{"conn":{"host":"127.0.0.1","port":3306,"user":"root","pass":""}}'`
- Lint PHP: `php -l api.php`. Type-check front-end: `npm run build` (runs `tsc -b`).
- Visual verify: use chrome-devtools MCP (navigate `http://strata.test/` or `http://localhost:5173/` → screenshot → check console).

### Local DB (dev)
Herd MySQL on `127.0.0.1:3306`, user `root`, no password. `wp` DB has real tables (e.g. `wp_users`) good for testing. `assetrail` is empty — don't use it for grid tests.

## API contract (`api.php?action=…`)

| action | params | returns |
|---|---|---|
| `databases` | — | `{databases:[]}` |
| `create_database` | `name` | `{ok,name}` (utf8mb4 / unicode_ci) |
| `create_table` | `db,name,columns[{name,type,nullable,auto_increment,pk}]` | `{ok,db,name}` (InnoDB / utf8mb4) |
| `drop_database` | `db` | `{ok,dropped}` |
| `drop_table` | `db,table` | `{ok,dropped}` |
| `alter_table` | `db,table,ops[{op:'change'\|'add'\|'drop',orig?,name,type,nullable,auto_increment,default?}]` | `{ok,altered}` (CHANGE/ADD/DROP COLUMN; `change` preserves the existing DEFAULT) |
| `tables` | `db` | `{tables:[{name,rows,type,engine,size}]}` |
| `columns` | `db,table` | `{columns:[{name,type,coltype,key,nullable,default,extra}]}` (`coltype` = full e.g. `varchar(255)`) |
| `rows` | `db,table,page,per_page,sort,dir,search` | `{columns,rows,total,page,pages,…}` |
| `test_connection` | (creds only) | `{ok,version,host}` |
| `row_get` | `db,table,pk{}` | `{columns,row}` |
| `row_save` | `db,table,values{}[,pk{}][,transforms{col:'md5'\|'sha1'\|'sha256'}]` | `{ok,mode,affected\|insertId}` (pk present ⇒ update, absent ⇒ insert; `transforms` hashes the value server-side) |
| `row_delete` | `db,table,pks[{}]` | `{ok,deleted}` (transactional) |
| `export_csv` | `db,table,search,sort,dir` | streamed `text/csv` (all matching rows) |
| `stats` | `db` | `{version,uptime,dbCount,tableCount,dbSize,threads*,questions,slowQueries,bytes*,breakdown}` |
| `query` | `db,sql` | `{type:'result',columns,rows,rowCount,ms}` or `{type:'exec',affected,ms}` |

Every request is **POST** with a JSON body `{conn:{host,port,user,pass,db?}, ...params}`.
`conn` carries the active profile's creds (api.php reads them there; no hardcoded creds).
Action stays in the query string. Params may be in the query string or the body.

All planned API actions implemented.

## Conventions / guardrails

- **SQL safety:** db/table/column identifiers are NEVER trusted from input — validate against `information_schema` before backtick-interpolating (`assertDb`/`assertTable`/`columnsOf` in api.php). Values always use bound params. For DDL on names that don't exist yet (`create_database`/`create_table`), `assertIdent` whitelists `[A-Za-z0-9_$]{1,64}`; column types are regex-checked, then everything is still backtick-quoted via `qid`.
- **Errors:** every API error returns JSON `{error}` + HTTP status. UI must show inline, never a blank grid.
- **Creds:** DB creds are sent per-request from the client (localStorage profiles) in the JSON body `conn`. `api.php` is stateless — no hardcoded creds. Passwords persist only when "Remember password" is on; otherwise kept in-memory and re-prompted on reload.
- **Theming:** CSS-variable tokens with Light/Dark/System modes — tokens live in `src/index.css`, mapped to Tailwind classes in `tailwind.config.ts`. Never hardcode colors; add/use tokens. Pre-paint theme script stays inline in `index.html` head (avoids flash).
- **Server state:** use TanStack Query for all db/table/row fetching (cache + loading/error). URL (React Router) holds active db/table + page/sort/search. Keep `api.ts` the single typed entry to `api.php`.

## Git

- React rebuild lives on branch `react`. Commit when the user asks. Author: Jakaria Istauk <jakariamd35@gmail.com>.
- `ui/` and `legacy/` are gitignored (reference only). Don't re-add them.
- `node_modules/`, `dist/`, the large `.zip`, and `tsc -b` artifacts (`*.tsbuildinfo`, `vite.config.js/.d.ts`) are gitignored.

## Status

React SPA rebuild (branch `react`). The API (`api.php`) and all its actions above are complete and unchanged. Front-end phases — see [docs/PLAN.md](docs/PLAN.md):

- **Phase 1 (Scaffold) ✅** — Vite+TS+Tailwind, token theming, lucide, self-hosted fonts, Query client, dev proxy; builds to `dist/`, `strata.test` linked, `make zip` round-trip verified.
- **Phase 2 (Data layer) 🚧 NEXT** — `api.ts`/`types.ts`/`lib/profiles.ts` + ConnModal.
- Phases 3–8: Explorer core · Row CRUD · Grid polish · SQL editor + Dashboard · Schema ops · Cutover.

Per-column **formats** (md5/sha1/sha256) are a Strata-only property kept in localStorage (`strata-formats:<db>.<table>`); on row save the client sends `transforms` for new/edited fields and `api.php` hashes server-side. Untouched hashed fields aren't re-hashed on edit. (Lands in the React build at Phase 4/7.)
