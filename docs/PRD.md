# Strata — Product Requirements (PRD)

**A modern, self-hosted database admin client.** Custom UI over a thin PHP+PDO JSON API.

- **Status:** Phase 0 complete (Explorer foundation working against live MySQL).
- **Owner:** jakariamd35@gmail.com
- **Name:** Jakaria Istauk
- **Github:** https://github.com/jakaria-istauk
- **Last updated:** 2026-06-23

---

## 1. Vision

A premium, focus-oriented DB admin tool for developers and data architects. High information density, dark-first aesthetic ("Kinetic Engineering" design system), zero server dependency beyond PHP + a reachable MySQL.

Runs anywhere PHP runs (`php -S`, Herd, Apache, nginx+fpm). Decoupled from Herd.

## 2. Goals

- G1. Browse databases, tables, and rows with a fast, dense, beautiful grid.
- G2. Run arbitrary SQL with a real editor and results grid.
- G3. Edit data safely (insert / update / delete) with confirmation.
- G4. Connect to **any** MySQL via a settings page — creds in localStorage, not hardcoded.
- G5. Light / Dark / System (device-preference) theming.
- G6. Ship as a pre-built static bundle + `api.php`; recipient runs it with only PHP (no Node/npm).

## 3. Non-Goals (v1)

- Multi-engine (Postgres/SQLite) — MySQL/MariaDB only for v1.
- User accounts / multi-tenant auth (it's a local/self-hosted tool).
- Schema migrations / DDL designer (basic DDL view only).
- Real-time collaboration.

## 4. Personas

- **Dev (primary):** wants a fast, modern local MySQL admin tool with a nicer UI.
- **Data architect:** browses large tables, writes ad-hoc SQL, inspects schema.

## 5. Features & Requirements

### F1 — Connection management *(new)*
- Settings page: host, port, user, password, optional default DB.
- Multiple saved **connection profiles** in localStorage.
- Active profile sent to API per request (header or POST body).
- Password persistence optional (toggle: "remember password").
- "Test connection" button.
- **Security:** localStorage is plaintext + creds traverse browser→PHP. Acceptable for local/self-hosted; documented. Recommend HTTPS / localhost-only binding.

### F2 — Explorer (data browser) *(done in Phase 0)*
- DB selector, table list with live row counts + filter.
- Data grid: dynamic columns, PK key icon, NULL styling, status badges, zebra rows, sticky header.
- Server-side sort, search, pagination, per-page (50/100/500).
- Export current page to CSV. *(Full-table export = enhancement.)*

### F3 — Row CRUD
- Row detail drawer/modal (read).
- Edit row (update by PK), insert new row, delete row(s) with confirm.
- Bulk delete from selected checkboxes.
- Type-aware inputs (date, enum, text, number, null toggle).

### F4 — SQL Editor (Query Runner)
- Code editor (CodeMirror or textarea+highlight), Run / Explain / Save.
- Results grid (reuse Explorer grid), error surfacing, query timing.
- Query tabs, basic history (localStorage).

### F5 — Theming
- Three modes: **Light**, **Dark**, **System**.
- Token-driven via CSS variables; Tailwind reads variables.
- Mode persisted in localStorage; System follows `prefers-color-scheme` live.
- Toggle in top bar.

### F6 — Dashboard *(later)*
- Stats cards (connections, tables, size), slow queries, server status.
- Net-new; needs metrics queries (`SHOW STATUS`, `information_schema`).

## 6. Success Metrics

- Explorer first-paint < 500ms on local MySQL.
- Grid handles 500-row page without jank.
- Switch connection/theme without reload.
- Runs via `php -S` with no extra deps.

## 7. Technical Constraints

- PHP 8.x with `pdo_mysql`.
- Front-end: React 18 + TypeScript + Vite + Tailwind v3 (TanStack Query, React Router). No CDN — icons (lucide-react) and fonts self-hosted.
- No DB-side schema for Strata itself; all state in localStorage.
- All identifiers validated against live schema before interpolation (SQL-injection safe).

## 8. Open Questions

- CodeMirror (richer) vs lightweight highlighter for F4?
- Encrypt passwords in localStorage, or just offer "don't persist"?
- Bundle Tailwind build now or defer to pre-release?
