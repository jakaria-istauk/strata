# Strata for WordPress — Implementation Plan

A WordPress plugin that re-houses Strata (React SPA + PHP/PDO engine) inside `wp-admin` as a modern phpMyAdmin replacement. Reuses the existing front-end and SQL engine; rewrites the transport/auth layer to WP-native and adds WP-aware features.

> Separate track from the main [PLAN.md](PLAN.md). The standalone Strata app stays as-is; this fork wraps the same code for WordPress.

---

## Why

- WP site already has MySQL + credentials in `wp-config.php` → zero-config DB admin.
- Most hosts ship clunky or no phpMyAdmin. One-click admin page beats it.
- Strata's React UI + SQL guards (`assertDb`/`assertTable`/`columnsOf`, bound params) port directly.
- Two moats over phpMyAdmin: **modern UX** + **WP-aware features** (serialized-data decode, search-replace, context links).

---

## Architecture

```
wp-admin page  — React SPA (same src/, hash router instead of BrowserRouter)
        │  every call = REST POST /wp-json/strata/v1/<action>
        │  X-WP-Nonce header; creds NOT in body
        ▼
WP REST controller  (PHP — wraps current api.php logic)
  - current_user_can('manage_options') on EVERY request
  - wp_verify_nonce / register_rest_route permission_callback
  - creds read server-side from wp-config constants (DB_HOST/USER/PASSWORD/NAME)
  - keeps Strata identifier whitelisting + bound params
        ▼
   site MySQL (default)  |  external/remote DB (Pro)
```

### Transport shift (standalone → WP)

| Standalone Strata | WP plugin |
|---|---|
| `api.php?action=…` POST, creds in `conn` body | REST route `/wp-json/strata/v1/<action>`, nonce header |
| localStorage connection profiles | site DB auto-detected; extra profiles in user meta |
| `dist/` served by Herd/`herd link` | assets enqueued via `wp_enqueue_script` on the plugin admin page only |
| `BrowserRouter` + SPA fallback | `HashRouter` (admin page = single PHP entry, no rewrite) |
| open API | gated: cap check + nonce on every route |

### Plugin layout

```
strata-wp/
  strata.php              plugin header, bootstrap, admin menu, enqueue
  includes/
    class-rest.php        register_rest_route for each action (ports api.php logic)
    class-auth.php        cap + nonce permission_callback
    class-db.php          PDO connect from wp-config constants (or stored profile)
    class-serialized.php  PHP serialize/unserialize view+edit helper
    class-search-replace.php
  build/                  Vite output (enqueued); src/ shared with standalone
  readme.txt              WP.org-format readme (stable tag, GPL)
```

---

## Phases — each shippable + verifiable in `wp-admin`

### Phase 1 — Plugin scaffold + auth spine
- Plugin header, activation hook, admin menu page (`add_menu_page`, `manage_options`).
- `class-auth.php`: shared `permission_callback` = `current_user_can('manage_options')` + REST nonce.
- One smoke route (`/strata/v1/ping`) proving cap + nonce gating works.
- **Done:** non-admin gets 403; admin gets 200 with valid nonce, 403 without.

### Phase 2 — REST port of the engine
- Port every `api.php` action to `class-rest.php` REST routes. Keep `assertDb`/`assertTable`/`columnsOf`/`assertIdent` + bound params verbatim.
- `class-db.php`: build PDO from `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME` constants. No creds over the wire.
- **Done:** `curl` each route with a logged-in nonce returns the same JSON shape as standalone `api.php`.

### Phase 3 — Front-end re-host
- Enqueue Vite bundle on the admin page only. Swap `api.ts` transport: REST base URL + `X-WP-Nonce` instead of `conn` body. `BrowserRouter` → `HashRouter`.
- Drop the ConnModal gate for the site DB (auto-connected); keep theme/history/formats in localStorage.
- **Done:** full Explorer + grid renders inside `wp-admin` against the live site DB.

### Phase 4 — Feature parity
- Row CRUD, bulk delete, SQL editor + history, Dashboard stats, schema ops (create/drop/alter), CSV export — all working through REST.
- **Done:** Chrome-verify each Strata feature inside `wp-admin`, console clean.

### Phase 5 — WP-aware differentiators
- Auto-detect + highlight `wp_*` tables; "Site DB" as the default landing.
- **Serialized-data viewer/editor** (`class-serialized.php`) — decode PHP-serialized `options`/`*meta` values phpMyAdmin shows raw. Big differentiator.
- **Search-replace** (`class-search-replace.php`) — serialization-safe URL/string migration with a UI (beats raw `wp-cli search-replace`).
- Context links: `wp_users` row → user-edit screen, `wp_posts` → post editor.
- **Done:** decode a serialized option, run a dry-run search-replace, follow a context link.

### Phase 6 — Hardening + distribution
- Audit-log writes to a custom table; optional read-only mode; multisite gating (`manage_network` / super admin only).
- WP.org compliance: GPL, no external CDN (fonts/icons/Tailwind already self-hosted ✓), no obfuscation, `readme.txt` with stable tag.
- Pro split: single site DB free; external/remote DB + scheduled backup Pro.
- **Done:** Plugin Check (PCP) passes; install/activate/uninstall clean on single + multisite.

---

## Security — critical (different threat model)

DB admin inside WP = high-value target. Non-negotiable:
- **Cap check server-side on every REST route** (`manage_options`; multisite → super admin). Never trust the client.
- **Nonce** on every request (CSRF) via REST `permission_callback`.
- Creds read from `wp-config.php` constants server-side only — never sent client→server.
- Port Strata's identifier whitelisting + bound params intact; reviewers will scrutinize raw SQL execution.
- Optional read-only mode + audit log for defense-in-depth.

---

## Risks

- WP.org review scrutinizes arbitrary SQL execution — document cap + nonce gating prominently.
- React bundle size — lazy-load, enqueue only on the plugin page.
- Multisite edge cases (network vs site DB, cap model).
- Hash router required (admin page is a single PHP entry, no SPA rewrite).

---

## Effort

- **REST + auth port (Phases 1–2):** medium — logic reusable, wrapper rewritten.
- **Front-end re-host (Phase 3):** small — mostly transport swap in `api.ts` + router change.
- **WP-aware features (Phase 5):** net-new — where the real product value lives.
