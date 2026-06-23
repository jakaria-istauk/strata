# Strata — Implementation Plan

React SPA front-end over a thin PHP+PDO JSON API. Phased build; each phase = shippable + verifiable in the browser. The API (`api.php`) and its feature set are complete — these phases rebuild the **front-end** as a fast React single-page app.

---

## Architecture

```
browser — React SPA (Vite + TS + Tailwind + TanStack Query + React Router)
  localStorage: connection profiles, active profile, theme mode, query history,
                per-column formats, hidden columns
        │  every API call = POST JSON { conn:{host,port,user,pass,db?}, ...params }
        ▼
api.php  (PHP + PDO, stateless — unchanged)
  - reads creds from request (NOT hardcoded)
  - validates identifiers vs live schema; bound params for values
        ▼
   any MySQL (Herd / Docker / brew / remote)
```

### Build & serve
- **Dev:** `npm run dev` (Vite :5173); proxies `/api.php` → `http://strata.test` (Herd runs PHP+MySQL — no separate `php -S`).
- **Prod:** `npm run build` → `dist/` (index.html + hashed assets + `api.php` copied in). `strata.test` is `herd link`ed to `dist/`, so SPA + API are same-origin. (No SSL on the link → use `http://`.)
- **Shareable bundle:** `make zip` → `strata.zip` of the built `dist/`. Recipient needs only PHP: `unzip … && php -S 127.0.0.1:8000`.

### File layout
```
/                      repo root
  README.md  CLAUDE.md  Makefile  package.json
  index.html           Vite entry (pre-paint theme script + #root)
  api.php              JSON gateway (unchanged)
  vite.config.ts  tailwind.config.ts  tsconfig*.json  postcss.config.js
  public/
    assets/strata-logo.png
    fonts/             3 latin variable woff2 (Inter / Geist / JetBrains Mono)
  src/
    main.tsx           mount: QueryClient + RouterProvider
    index.css          Tailwind + theme tokens + @font-face
    api.ts  types.ts   typed gateway wrapper + API contract types
    lib/               profiles.ts, formats.ts, theme.ts
    hooks/             useDatabases / useTables / useRows / useColumns / useStats
    routes/            route components
    components/        Sidebar, Grid, RowDrawer, QueryEditor, Dashboard, modals…
  docs/
    PRD.md  PLAN.md
  dist/                build output (gitignored) — strata.test serves this
```

### Conventions
- **No CDN:** icons via lucide-react; fonts self-hosted in `public/fonts/`.
- **Theme:** Light/Dark/System. Pre-paint script inline in `index.html` head (avoids flash); runtime switch in `lib/theme.ts`. Colors are CSS-variable tokens in `src/index.css`, mapped to Tailwind classes in `tailwind.config.ts` — never hardcode colors.
- **Creds:** stateless. Active profile's creds sent per-request in body `conn`. Passwords persist only when "Remember" is on; else kept in-memory, re-prompted on reload.
- **Server state:** TanStack Query for all db/table/row fetching (cache + loading/error). URL (React Router) holds active db/table + page/sort/search.

---

## Phase 1 — Scaffold ✅ DONE
- [x] Vite + React 18 + TS; Tailwind v3 with token classes ported from the old theme.
- [x] Pre-paint theme script; `lib/theme.ts` runtime switch (Light/Dark/System).
- [x] lucide-react icons; 3 self-hosted latin variable woff2 (no Google CDN).
- [x] QueryClient provider; dev proxy `/api.php` → strata.test.
- [x] Build → `dist/` (+ api.php); `strata.test` linked; `make zip` round-trip.
- **Verified (Chrome):** renders at strata.test + from clean unzip; fonts loaded; console clean.

## Phase 2 — Data layer ✅ DONE
- [x] `src/api.ts` — typed `api(action, params)` POST wrapper (injects active `conn`, throws `ApiError` on `{error}`/non-2xx/network).
- [x] `src/types.ts` — API contract types (Conn, Profile, Column, Row, RowsResult, Stats, QueryResult, …).
- [x] `lib/profiles.ts` — localStorage profiles, active id, runtime-only passwords, `connFor()`/`activeConn()`.
- [x] ConnModal + profile CRUD (add/edit/delete/switch) + `test_connection`.
- [x] Gate the app on an active connection; password re-prompt when `remember` is off.
- **Verified (Chrome):** no-profile gate → ConnModal; Test → "Connected · MySQL 9.2.0"; Save & Connect → live `databases` (13) via TanStack Query; reload re-prompts password (remember off); unlock restores; console clean.

## Phase 3 — Explorer core ✅ DONE
- [x] Sidebar: DbSelect + filterable TableList (row counts).
- [x] Routing: `/db/:db`, `/db/:db/table/:table`; page/sort/dir/search in URL search params (BrowserRouter + Herd SPA fallback).
- [x] Grid (sortable headers, PK icon, NULL/empty styling) + Pagination + Toolbar (search). Hooks: `useDatabases`, `useTables`, `useRows` (keepPreviousData).
- **Verified (Chrome):** db switch → tables; open table → grid; sort toggles ASC/DESC (resets page); paginate; search filters (1,231→173) — all reflected in URL; deep-link loads; console clean.

## Phase 4 — Row CRUD 🚧 NEXT
- [ ] RowDrawer (view / edit / new), NULL toggle.
- [ ] Per-column formats → `transforms` on save (`lib/formats.ts`).
- [ ] Bulk delete; ConfirmDanger (type-to-confirm); Toast.

## Phase 5 — Grid polish
- [x] Column show/hide (persisted in `lib/columnPrefs.ts`, `ColumnToggle`) — landed early in Phase 3.
- [ ] Foreign-key links.
- [ ] Full-table CSV export (streamed). Keyboard shortcuts. Loading/empty/error states.

## Phase 6 — SQL editor + Dashboard
- [ ] QueryEditor (`/db/:db/query`): run SQL, result grid vs exec, timing, history.
- [ ] Dashboard (`/db/:db/dashboard`): server stats cards + size breakdown.

## Phase 7 — Schema ops
- [ ] NewDbModal, NewTableModal (column builder).
- [ ] StructModal: alter table (rename/retype/null/AI, add & drop columns) + per-column formats.
- [ ] Drop database / drop table (type-to-confirm).

## Phase 8 — Cutover
- [ ] Final README + Makefile; CLAUDE.md updated to the React stack.
- [ ] Remove obsolete vanilla source files from the repo.

---

## Cross-cutting
- **Security:** identifier whitelisting + schema validation in `api.php` (unchanged); bound params for values; recommend localhost/HTTPS for remote.
- **Errors:** every API error → JSON `{error}`; UI shows inline, never a blank grid.
- **Testing:** manual browser verify per phase via chrome-devtools MCP; smoke-test API via curl.

## Sequencing rationale
Data layer + connection (P2) is foundational — every screen needs the typed gateway and creds model — so it lands before the Explorer, CRUD, SQL, and Dashboard screens.
