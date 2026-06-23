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
/                      repo root (git: strata)
  PRD.md  PLAN.md  README.md
  app/
    index.html         shell + Explorer
    api.php            JSON gateway
    assets/
      strata.css       CSS-variable theme tokens (light/dark)
      strata.js        app logic (modularised from inline)
    legacy/            old adminer index.php (reference, gitignored or archived)
  ui/                  design mockups (reference)
```

---

## Phase 0 — Foundation ✅ DONE
- [x] PHP+PDO JSON API: `databases`, `tables`, `columns`, `rows`
- [x] Explorer SPA: grid, sort, search, pagination, CSV, table list
- [x] Verified live against Herd MySQL + via `php -S` (Herd-independent)

## Phase 1 — Rebrand + Theming
**Goal:** Strata identity + Light/Dark/System modes.
- [ ] Rename NexusDB → **Strata** (title, logo, footer, version).
- [ ] Extract inline styles → `assets/strata.css` using CSS variables.
- [ ] Define **two token sets**: light + dark (from DESIGN.md, plus a light palette).
- [ ] Tailwind config reads `var(--…)` so utilities theme automatically.
- [ ] Theme switcher (top bar): Light / Dark / System.
- [ ] `System` mode: live-follow `matchMedia('(prefers-color-scheme: dark)')`.
- [ ] Persist mode in localStorage; apply before first paint (no flash).
- **Verify:** toggle all 3 modes, reload, OS theme change reflects in System mode.

## Phase 2 — Connection Settings
**Goal:** connect to any MySQL; creds in localStorage.
- [ ] Settings page/modal: host, port, user, password, default DB, profile name.
- [ ] Multiple profiles; active-profile selector in sidebar.
- [ ] `api.php`: read creds from request; drop hardcoded constants.
- [ ] `action=test_connection` → ping + return server version.
- [ ] "Remember password" toggle (else session-only / re-prompt).
- [ ] First-run: if no profile, show connect screen.
- **Verify:** add a 2nd MySQL profile, switch, browse; wrong creds → clean error.
- **Security note in README:** plaintext localStorage, localhost binding recommended.

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
