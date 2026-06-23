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

## Phase 3 — Row CRUD
**Goal:** safe data editing.
- [ ] `row_get` (by PK), `row_save` (insert/update), `row_delete`.
- [ ] Row detail drawer (read) → Edit mode.
- [ ] Type-aware inputs; NULL toggle; PK/auto-increment handling.
- [ ] New Record form. Delete with confirm. Bulk delete from checkboxes.
- [ ] Optimistic refresh / error rollback.
- **Verify:** insert/edit/delete a row in a scratch table; PK-less table guarded.

## Phase 4 — SQL Editor (Query Runner)
**Goal:** run arbitrary SQL.
- [ ] `action=query` → run SQL, return columns+rows or affected-count+error.
- [ ] Editor (CodeMirror or lightweight), Run / Explain (prefix `EXPLAIN`).
- [ ] Results reuse Explorer grid. Query timing + row count.
- [ ] Query tabs + history in localStorage.
- **Verify:** SELECT, UPDATE, EXPLAIN, and a syntax error each render correctly.

## Phase 5 — Dashboard (optional)
- [ ] Metrics: connections, DB count/size, table count, slow queries.
- [ ] Stats cards + simple charts (sparkline/canvas, no heavy dep).
- **Verify:** numbers match `SHOW STATUS` / information_schema.

## Phase 6 — Polish / Pre-release
- [ ] Full-table CSV export (streamed).
- [ ] Column show/hide, foreign-key links.
- [ ] Tailwind CLI build (drop CDN), minify.
- [ ] Keyboard shortcuts, empty/error states, loading skeletons.
- [ ] README: install, run, security.

---

## Cross-cutting

- **Security:** identifier whitelisting (done), bound params for values, creds-in-transit doc, recommend localhost/HTTPS.
- **Errors:** every API error → JSON `{error}`; UI shows inline, never blank grid.
- **No framework:** keep vanilla; split `strata.js` into small modules if it grows.
- **Testing:** manual browser verify per phase via chrome-devtools MCP; smoke-test API via `php -r`/curl.

## Sequencing rationale
Theming (P1) + Connection (P2) are foundational reworks touching every screen — do them before adding CRUD/SQL/Dashboard so new screens inherit tokens + creds model from day one.
