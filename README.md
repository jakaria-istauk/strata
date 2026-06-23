# Strata

A modern, self-hosted database admin client — custom UI over a thin PHP+PDO JSON API. A full UI replacement for Adminer, not a theme.

> Status: early. Phase 0 (Explorer) working. See [docs/PLAN.md](docs/PLAN.md) and [docs/PRD.md](docs/PRD.md).

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
