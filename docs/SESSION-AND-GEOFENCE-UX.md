# Session expiry UX + geofence drawing (plan)

## Session expiry (tenant-admin + system-admin)

**Bug:** Soft-nav to `/login` while cookies still present keeps the authenticated root layout shell, so the login form appears inside the sidebar/header.

**Fix:**
1. Validate JWT `exp` in `/api/check-auth` (not cookie presence alone).
2. Persist `refreshToken` httpOnly cookie; `POST /api/session/extend` renews access via `POST /v1/auth/refresh`.
3. Modal when JWT is near expiry (≤2 min) or idle warning: **Extend session** / **Log out**.
4. If no answer within **90s**, hard logout: clear cookies + `window.location.assign('/login?error=…')` (never `router.push`).
5. Middleware clears auth cookies on `/login?error=*` so a full page load never paints the admin shell.

## Geofence drawing + reusable templates

**Draw:**
- Circle: click center + radius (rank/depot/fuel/forbidden).
- Corridor: click path (≥2), buffered on save.
- Polygon / custom: click vertices; snap-close near first point (or Close shape); ≥3 points → closed polygon.

**Templates:**
- Save any zone geometry as a named tenant template.
- Apply (instantiate) creates a new geofence copy in the library, assignable to any vehicle.

Ship with API normalize path→Polygon for non-corridor, `fence_templates` table, and geofences UI panel.
