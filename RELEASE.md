## Release and Versioning

This repo follows semantic versioning: `MAJOR.MINOR.PATCH`.

### Current stable

- **First stable platform release:** `platform-v1.0.0` (2026-09-17).
- Package versions: API / tenant-admin / system-admin / root = `1.0.0`; mobile = `1.0.0+1` in `app/pubspec.yaml`.
- Admin UIs display the version from build arg `NEXT_PUBLIC_APP_VERSION` (must be set in Docker Compose build args). Fallback in source is `1.0.0`.
- Keep [`CHANGELOG.md`](./CHANGELOG.md) updated for every tagged release.

### Tags

- `platform-vX.Y.Z` for coordinated releases across API + admin apps.
- `api-vX.Y.Z`, `system-admin-vX.Y.Z`, `tenant-admin-vX.Y.Z`, `mobile-vX.Y.Z` for individual releases.

### Strategy

- **MAJOR**: breaking API changes or tenant schema migrations requiring client updates.
- **MINOR**: backward-compatible features (new endpoints, UI features) — use for P0 feature ships after 1.0.0.
- **PATCH**: bug fixes and security patches.

### Release Checklist

1. Update version(s) in the relevant app(s) (`package.json` / `pubspec.yaml`).
2. Update `CHANGELOG.md`.
3. Ensure Docker build args pass `NEXT_PUBLIC_APP_VERSION` for admin apps.
4. Run tests + smoke checks.
5. Run DB migrations in a staging environment when schema changed.
6. Commit, tag the release, and push the tag.
7. Redeploy **one service at a time** on the droplet (`api` → `tenant-admin` → `system-admin`).

### Patch Release Automation

Patch bumps are automated with guarded scripts and optional GitHub workflow dispatch.

- Dry run (no file changes committed):

```
npm run release:patch:dry
```

- Create patch release commit + tag locally (platform scope):

```
npm run release:patch
```

- Target-specific patch bump:

```
node scripts/release/patch-release.js --scope api --create-commit --create-tag
```

Supported scopes: `platform`, `api`, `system-admin`, `tenant-admin`, `mobile`.

Guardrails:

- Derives next version from latest matching release tag.
- Only increments `PATCH` (no major/minor in this flow).
- Refuses to reuse an existing tag.
- Refuses dirty working tree unless `--allow-dirty`.

For **minor/major** bumps after feature work, set versions manually (or use a future `bump-release.js --level minor|major`), update CHANGELOG, then tag `platform-vX.Y.Z`.

### Deploy Tag Controls

Production deploy workflow deploys for `platform-vX.Y.Z` tags (or manual dispatch).

- On tag push, workflow validates semver tag format before deploy.
- Prefer checking out the exact release tag on the droplet for deterministic deploys.

Example:

```
git tag platform-v1.0.0
git push origin platform-v1.0.0
```

### Production Deploy

Redeploy one service at a time to avoid OOM on small droplets:

```
cd /opt/vehicle_income_tracker/deploy
bash redeploy.sh --services api
bash redeploy.sh --services tenant-admin
bash redeploy.sh --services system-admin
```

- Run migrations when needed: `npm run migration:run` (from API context)
- Verify health endpoints, auth flows, and admin footer version string
