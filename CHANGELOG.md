# Changelog

All notable changes to **Strata** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] — 2026-06-28

### Added
- **Dashboard action link** on the WordPress Plugins page — jump straight to Strata without the admin menu.

### Fixed
- **Hardened the SQL-console cross-database guard** (WP) against regex bypasses — `/* */` comments, no-space `FROM(other.x)`, and `SHOW TABLES FROM <db>` can no longer escape the site database.
- **Self-heal stale update notices** (WP) — a phantom "update available" left by an out-of-band file update is now cleared on the next update check instead of persisting until a manual update.
- **Pagination "Rows" dropdown** no longer inherits WordPress admin form styling — it matches the app theme again.
- App version label now tracks `package.json`, so the sidebar footer matches the plugin version.

## [1.2.1] — 2026-06-26

### Fixed
- **WordPress auto-updater reliability** — register the updater at load so cron transient rebuilds include it, and rename the unpacked release directory to the plugin slug so updates land back in the same folder instead of orphaning the plugin.

## [1.2.0] — 2026-06-26

### Added
- **Rich-cell viewer** — inspect JSON, PHP-serialized, and datetime values in a dedicated cell viewer, with a searchable timezone picker for datetimes.
- **Advanced search drawer** — per-column query builder for composing multi-condition row filters.
- **Flexible rows-per-page picker** — choose 50 / 100 / 250 / 500 rows per page in the grid.
- **Header breadcrumb** for back navigation across db / table / view.
- **Standalone GitHub update check** with an in-app sidebar notice when a new release is available.
- **Full-screen toggle** that hides the WordPress admin chrome and slides the drawer in (WP build).
- **GitHub release auto-updater** for the WordPress plugin.
- **Styled hash picker** in the row drawer, with save errors now always visible.

### Fixed
- Pin the Strata app to the viewport and give the WordPress admin menu its own scroll (WP build).

## [1.1.0] — 2026-06-25

### Added
- **WordPress plugin** (`strata-wp`) — re-hosts the React front-end inside wp-admin as a phpMyAdmin replacement, with a REST port of the engine and WP-aware tools.
- Plugin distribution via site download and GitHub release; `make wp-zip` packager.

### Fixed
- Lock the plugin to the single site DB for privacy.
- Suppress admin notices on the Strata screen to protect the SPA layout.
- Theme-on-load, layout chrome, brand icon, drawer z-index/exit animation, and debounced local search.

## [1.0.0] — 2026-06

### Added
- Initial release — React SPA over a thin PHP + PDO JSON API: connection profiles, database/table explorer, sortable grid, row CRUD, bulk delete, CSV export, SQL editor with history, dashboard stats, and schema operations (create/drop database & table, alter table).

[1.2.2]: https://github.com/jakaria-istauk/strata/releases/tag/v1.2.2
[1.2.1]: https://github.com/jakaria-istauk/strata/releases/tag/v1.2.1
[1.2.0]: https://github.com/jakaria-istauk/strata/releases/tag/v1.2.0
[1.1.0]: https://github.com/jakaria-istauk/strata/releases/tag/v1.1.0
[1.0.0]: https://github.com/jakaria-istauk/strata/releases/tag/v1.0.0
