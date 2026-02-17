# Deployment and Environment Management

This folder contains deployment helpers for local and production-like setups.

**Before going to production**, use the **[Deployment readiness checklist](./DEPLOYMENT-READINESS.md)**.

**DigitalOcean Droplet + domains at your provider:** see **[DIGITALOCEAN-DROPLET.md](./DIGITALOCEAN-DROPLET.md)** for DNS at your registrar, droplet setup, Nginx + Let’s Encrypt, and binding app ports to localhost.

## Local stack (API + Postgres + Admin UIs)

1. Copy `env.example.txt` to `.env` in this folder.
2. Copy `secrets.example/` to `secrets/` and fill in real values.
3. Update secrets in `.env` (or rely on the `*_FILE` entries).
3. Run:

```
docker compose -f deploy/docker-compose.yml up -d
```

By default the deploy compose uses **host ports 3010, 3011, 3012** (to avoid clashes with other services). Override with `API_PORT`, `SYSTEM_ADMIN_PORT`, `TENANT_ADMIN_PORT` in `.env` if needed.

- API: `http://localhost:3010` (or `API_PORT`)
- System Admin: `http://localhost:3011` (or `SYSTEM_ADMIN_PORT`)
- Tenant Admin: `http://localhost:3012` (or `TENANT_ADMIN_PORT`)

## Environment variables

API uses the same env vars as `api/config/env.example.txt`, including:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`
- `BOOTSTRAP_TOKEN`
- `FORCE_MFA_FOR_ADMINS`
- `*_FILE` secrets (e.g. `DB_PASSWORD_FILE`)
- **Email (Mailgun):** `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM` (or SMTP fallback: `EMAIL_USER`, `EMAIL_PASSWORD`, etc.)
- **Production builds:** `NEXT_PUBLIC_API_URL` (e.g. `https://api.yourdomain.com`) so the frontends call the correct API from the browser. Set in `deploy/.env` before `docker compose build`.
- **CORS:** `CORS_ORIGINS` must list your production frontend URLs (e.g. `https://admin.yourdomain.com,https://app.yourdomain.com`).

Tenant-level MFA enforcement is managed in System Admin → Tenants (Admin MFA / Driver MFA).

## Email setup (Mailgun)

**Option A – Mailgun HTTP API (recommended)**

1. In Mailgun Dashboard → Sending → API keys, create or copy your private API key.
2. In `.env` (or `api/.env`) set:
   - `MAILGUN_API_KEY` = your Mailgun API key (e.g. `key-xxx...`)
   - `MAILGUN_DOMAIN` = your sending domain (e.g. `sandbox0ddb6eedbca54c0eb9d8ae2987fe5427.mailgun.org`)
   - `EMAIL_FROM` = e.g. `Mailgun Sandbox <postmaster@sandbox...mailgun.org>`
3. For EU region, set `MAILGUN_URL=https://api.eu.mailgun.net`.

**Option B – SMTP fallback**

If `MAILGUN_API_KEY` is not set, the app falls back to SMTP. Set `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_HOST`, `EMAIL_PORT` (e.g. Mailgun SMTP: `smtp.mailgun.org`, 587).

**Sandbox:** Mailgun sandbox only delivers to *authorized recipients*. In Dashboard → Sending → Authorized recipients, add each address that should receive mail.

**Test email:**

```bash
curl -X POST http://localhost:3010/email/test \
  -H "Content-Type: application/json" \
  -H "X-Email-Test-Secret: vit-test-email-secret" \
  -d '{"to":"neanimakhari7@gmail.com"}'
```

Use a recipient you added as authorized. If `EMAIL_TEST_SECRET` is set, use that value instead of `vit-test-email-secret`.

## Secrets flow

The docker compose file supports Docker secrets via `deploy/secrets/*.txt`. Use this in production.

Examples:
- `deploy/secrets/postgres_password.txt`
- `deploy/secrets/jwt_secret.txt`
- `deploy/secrets/jwt_refresh_secret.txt`
- `deploy/secrets/bootstrap_token.txt`

## Production env template

Use `deploy/env.production.example.txt` as a base for production deployments (file-based secrets by default).

## Production notes

- **Before building:** Set `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` in `deploy/.env` to your production domain. Frontends are built with that API URL baked in.
- Use a managed Postgres service and store secrets in your platform secret manager.
- Enable TLS at the ingress/load-balancer layer (e.g. Nginx + Let's Encrypt).
- Run migrations on deploy: the API container runs them on startup via `docker-entrypoint.sh`.
- Rotate JWT secrets on a schedule and invalidate old tokens if needed.

