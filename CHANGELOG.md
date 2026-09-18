# Changelog

All notable changes to Vehicle Income Tracker (VIT) are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Tenant-admin **1.1.0**: Scholar & staff transport passengers/groups/payments UI — sectioned forms, clearer CSV import, mobile-first grid.
- System-admin / tenant-admin: logout clears cookies with matching path/secure; Log out in mobile drawer; larger logout hit targets.
- API **1.1.0**: 5xx / unhandled errors email `ERROR_ALERT_TO` (default `dev@vehinc.co.za`) with throttle.
- API: `GET /v1/public/mobile-app/latest` for private app-store / in-app updates.
- Mobile **1.0.1+2**: in-app APK update check + download/install prompt; private store assets under `deploy/vit-app/`.

## [Unreleased] — feature/p0-sa-taxi-ops

### Added

- Daily income **target vs actual**: tenant default + per-driver targets, `GET /tenant/reports/targets/daily`, tenant-admin dashboard panel, Drivers table editor, mobile dashboard card.

## [1.0.0] — 2026-09-17

First **stable production** platform release (`platform-v1.0.0`). Aligns API, tenant-admin, and system-admin package versions at `1.0.0` (mobile remains `1.0.0+1`).

### Added

- Selective droplet redeploy (`deploy/redeploy.sh`, `redeploy.targets`, agent deploy docs) so services can be rebuilt one at a time.
- Tenant-admin: admin-triggered driver password reset flow.
- System-admin: session `AuthChecker` plus `/api/check-auth` and `/api/logout` routes.
- SA taxi industry feature strategy pack (`docs/VIT-SA-Taxi-Industry-Feature-Strategy.md`).
- Build-time `NEXT_PUBLIC_APP_VERSION` so admin UI footers show the real release version.

### Fixed

- First-login / change-password `401` caused by JWT strategy not exposing `sub`.
- Tenant-admin mobile layout overflow and toolbar/sidebar stacking across Drivers and related pages.
- Tenant-admin lockfile sync for Docker `npm ci`.
- Admin light/dark contrast (inverted body theme) and overflow-safe chrome on both admin apps.
- System-admin mobile sidebar flex/scroll layout.

### Security

- Password reset clears `mustChangePassword` correctly after admin-triggered resets.
- Idle session warning / forced logout path on system-admin via AuthChecker.

### Notes

- Large in-progress API modules (tracking, trips, payments, etc.) that were uncommitted at tag time are **not** part of 1.0.0.
- Subsequent hotfixes: `npm run release:patch` → `platform-v1.0.x`.
- P0 taxi-ops features ship on `feature/p0-sa-taxi-ops` as minor releases (`1.1.0+`).

[1.0.0]: https://github.com/neanimakhari/vehicle-income-tracker/releases/tag/platform-v1.0.0
