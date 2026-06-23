---
name: strata-dev
description: Run, smoke-test, and visually verify the Strata DB admin app. Use when working on Strata (index.html / api.php), starting the dev server, testing API actions, or confirming a UI change renders against live MySQL.
---

# Strata — Dev & Verify

Strata is a PHP+PDO JSON API (`api.php`) + vanilla-JS/Tailwind front-end (`index.html`), served from repo root. Full context: [CLAUDE.md](../../../CLAUDE.md), [PLAN.md](../../../PLAN.md).

## Before coding
1. Read [PLAN.md](../../../PLAN.md) — confirm which phase the requested work belongs to and what's already done.
2. Respect guardrails in [CLAUDE.md](../../../CLAUDE.md): identifier whitelisting, JSON `{error}` responses, no hardcoded colors (use tokens), creds model.

## Run
```bash
php -l api.php                          # lint before serving
php -S 127.0.0.1:8899                   # Herd-independent
# Herd is also live at http://strata.test/
```

## Smoke-test the API (no browser)
```bash
curl -s "http://strata.test/api.php?action=databases"
curl -s "http://strata.test/api.php?action=tables&db=wp"
curl -s "http://strata.test/api.php?action=rows&db=wp&table=wp_users&per_page=3"
# or without a web server:
php -r '$_GET=["action"=>"rows","db"=>"wp","table"=>"wp_users","per_page"=>"2"]; include "api.php";'
```
Use DB `wp` (real data). Avoid `assetrail` (empty).

## Visual verify (chrome-devtools MCP)
1. `new_page` → `http://strata.test/` (or the `php -S` URL).
2. `evaluate_script` to drive: set `#dbSelect` value + dispatch `change`, then click a table `<a data-table=…>` in `#tableList`.
3. `take_screenshot` — confirm grid renders real rows, PK key icon, badges, pagination.
4. `list_console_messages` (types: error,warn) — expect only the Tailwind-CDN dev warning + favicon 404; anything else is a regression.

## Done means
- `php -l` clean, API returns expected JSON, grid renders live data, console has no new errors.
- If the change is user-facing, screenshot it before reporting done.
