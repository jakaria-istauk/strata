# Strata — Implementation Plan

Phased build. Each phase = shippable + verifiable in browser. Order chosen so connection + theming (foundational rework) land before new screens.

---

## Architecture

```
browser (vanilla JS + Tailwind)
  localStorage: connection profiles, active profile, theme mode, query history
        │  every API call sends active connection creds (POST JSON / X-DB-* headers)
        ▼
app/api.php  (PHP + PDO, stateless)
  - reads creds from request (NOT hardcoded)
  - validates identifiers vs live schema
  - actions: databases, tables, columns, rows, query, row_get, row_save, row_delete
        ▼
   any MySQL (Herd / Docker / brew / remote)
```

### Key change from Phase 0
Creds move out of `api.php` constants → sent per-request from client. `api.php` becomes a pure stateless gateway. No server-side config file needed (localStorage is the source of truth).

### File layout (target)
```
/                      repo root (git: strata) — app served from here
  README.md  CLAUDE.md
  index.html           shell + Explorer
  api.php              JSON gateway
  assets/
    strata.css         CSS-variable theme tokens (light/dark)
    strata.js          app logic (modularised from inline)
  docs/
    PRD.md  PLAN.md    product + plan docs
  legacy/              old adminer (reference, gitignored)
  ui/                  design mockups (reference, gitignored)
```

---

## Phase 0 — Foundation ✅ DONE
- [x] PHP+PDO JSON API: `databases`, `tables`, `columns`, `rows`
- [x] Explorer SPA: grid, sort, search, pagination, CSV, table list
- [x] Verified live against Herd MySQL + via `php -S` (Herd-independent)

## Phase 1 — Rebrand + Theming ✅ DONE
**Goal:** Strata identity + Light/Dark/System modes.
- [x] Rename NexusDB → **Strata** (title, logo, footer, version).
- [x] Extract inline styles → `assets/strata.css` using CSS variables.
- [x] Define **two token sets**: light + dark (RGB-triplet tokens).
- [x] Tailwind config reads `var(--…)` so utilities theme automatically.
- [x] Theme switcher (top bar): Light / Dark / System.
- [x] `System` mode: live-follow `matchMedia('(prefers-color-scheme: dark)')`.
- [x] Persist mode in localStorage; apply before first paint (no flash).
- **Verified:** all 3 modes + reload persistence in Chrome (devtools MCP) + Firefox.

## Phase 2 — Connection Settings ✅ DONE
**Goal:** connect to any MySQL; creds in localStorage.
- [x] Settings modal: host, port, user, password, default DB, profile name.
- [x] Multiple profiles; active-profile selector in sidebar.
- [x] `api.php`: reads creds from request body `conn`; constants dropped.
- [x] `action=test_connection` → ping + return server version.
- [x] "Remember password" toggle (else session-only, re-prompt on reload).
- [x] First-run: no profile → blocking connect screen.
- **Verified (Chrome):** first-run, test, save, 2nd profile, switch, wrong creds → clean inline error, password re-prompt on reload.
- **Security note in README:** plaintext localStorage, localhost binding recommended (already documented).

## Phase 3 — Row CRUD ✅ DONE
**Goal:** safe data editing.
- [x] `row_get` (by PK), `row_save` (insert/update), `row_delete` (bulk, transactional).
- [x] Row detail drawer (read) → Edit mode.
- [x] Type-aware inputs (number/textarea); NULL toggle; PK/auto-increment locked.
- [x] New Record form. Delete with confirm. Bulk delete from row checkboxes.
- [x] Refresh after save/delete; errors shown inline in the drawer.
- **Verified (Chrome):** insert/edit/NULL/single-delete/bulk-delete on a scratch table; PK-less table is view-only (no checkboxes, no edit/delete).

## Phase 4 — SQL Editor (Query Runner) ✅ DONE
**Goal:** run arbitrary SQL.
- [x] `action=query` → result set (columns+rows) or affected-count; errors as JSON `{error}`.
- [x] Lightweight mono textarea editor; Run (⌘/Ctrl+Enter) / Explain (prefix `EXPLAIN`).
- [x] Results render in a grid; query timing + row/affected count.
- [x] Query tabs + history (last 40) in localStorage.
- **Verified (Chrome):** SELECT, EXPLAIN, exec (SET), and a syntax error each render correctly; tabs + history work.

## Phase 5 — Dashboard ✅ DONE
- [x] Metrics: connections, DB count, table count + size, uptime, queries, slow queries, bytes.
- [x] Stat cards + CSS query-breakdown bars (SELECT/INSERT/UPDATE/DELETE), no heavy dep.
- [x] `action=stats` reads `SHOW GLOBAL STATUS` + information_schema.
- **Verified (Chrome):** cards + bars render against live server; refresh works.

## Phase 6 — Polish / Pre-release ✅ MOSTLY DONE
- [x] Full-table CSV export (streamed server-side via `export_csv`, honors search/sort).
- [x] Column show/hide (per-table, persisted), foreign-key links (jump to referenced table).
- [ ] Tailwind CLI build (drop CDN), minify. — **deferred**: keeps the "no build step" model; CDN warning is dev-only.
- [x] Keyboard shortcuts (`/`, `n`, ⌘/Ctrl+Enter, Esc); loading + empty/error states.
- [x] README: features, shortcuts, run, security.
- **Verified (Chrome):** FK jump, column hide+persist, full-table export, loading state.

---

## Phase 7 — Schema ops 🚧 IN PROGRESS
- [x] Create database (`create_database`) — sidebar **+** by the DB selector → name modal; utf8mb4/unicode_ci.
- [x] Create table (`create_table`) — sidebar **+** by Tables → modal with column builder (name, type, PK, AUTO_INCREMENT, NULL); InnoDB/utf8mb4.
- [x] Drop database / drop table — trash buttons (DB selector + per-table hover) → type-to-confirm modal.
- [ ] Alter table (add/modify/drop column, indexes).
- **Safety:** new identifiers validated via `assertIdent` (whitelist), types regex-checked, all backtick-quoted. Drops validate against schema (`assertDb`/`assertTable`) and require typing the exact name to confirm.

---

## Cross-cutting

- **Security:** identifier whitelisting (done), bound params for values, creds-in-transit doc, recommend localhost/HTTPS.
- **Errors:** every API error → JSON `{error}`; UI shows inline, never blank grid.
- **No framework:** keep vanilla; split `strata.js` into small modules if it grows.
- **Testing:** manual browser verify per phase via chrome-devtools MCP; smoke-test API via `php -r`/curl.

## Sequencing rationale
Theming (P1) + Connection (P2) are foundational reworks touching every screen — do them before adding CRUD/SQL/Dashboard so new screens inherit tokens + creds model from day one.
