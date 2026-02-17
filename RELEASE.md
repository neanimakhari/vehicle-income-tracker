## Release and Versioning

This repo follows semantic versioning: `MAJOR.MINOR.PATCH`.

### Tags

- `platform-vX.Y.Z` for coordinated releases across API + admin apps.
- `api-vX.Y.Z`, `system-admin-vX.Y.Z`, `tenant-admin-vX.Y.Z`, `mobile-vX.Y.Z` for individual releases.

### Strategy

- **MAJOR**: breaking API changes or tenant schema migrations requiring client updates.
- **MINOR**: backward-compatible features (new endpoints, UI features).
- **PATCH**: bug fixes and security patches.

### Release Checklist

1. Update version(s) in the relevant app(s).
2. Update `CHANGELOG.md` (if in use).
3. Run tests + smoke checks.
4. Run DB migrations in a staging environment.
5. Tag the release and push tags.

Example:

```
git tag platform-v1.2.0
git push origin platform-v1.2.0
```

### Production Deploy

- Run migrations: `npm run migration:run`
- Deploy containers with updated tags
- Verify health endpoints and auth flows


