# Deployment readiness checklist

Use this list before deploying to production (or a production-like environment).

## 1. Secrets and environment

- [ ] **Secrets**  
  Create `deploy/secrets/` from `deploy/secrets.example/` and set strong values:
  - `postgres_password.txt` – Postgres DB password (no newline).
  - `jwt_secret.txt` – JWT access token secret (min 16 chars).
  - `jwt_refresh_secret.txt` – JWT refresh token secret (min 16 chars).
  - `bootstrap_token.txt` – Token for creating the first platform admin.

- [ ] **`deploy/.env`**  
  Copy from `deploy/env.example.txt` (or `env.production.example.txt` for production). Set:
  - **Production:** `NEXT_PUBLIC_API_URL` to your public API URL (e.g. `https://api.yourdomain.com`).  
    This is baked into the Next.js builds at **build time** – rebuild frontends after changing it.
  - **Production:** `CORS_ORIGINS` to your frontend origins, comma-separated (e.g. `https://admin.yourdomain.com,https://app.yourdomain.com`), no trailing slashes.
  - Optional: `API_PORT`, `SYSTEM_ADMIN_PORT`, `TENANT_ADMIN_PORT` if you need different host ports.

- [ ] **Email (production)**  
  For password resets, verification, and monthly reports:
  - Prefer **Mailgun**: set `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `EMAIL_FROM` in `.env`.
  - Or use SMTP: `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_PORT`, etc.
  - Ensure Mailgun (or SMTP) is configured for your domain and, if using sandbox, add authorized recipients.

## 2. Build and run with Docker Compose

- [ ] **Build with production API URL**  
  If deploying for production, set in `deploy/.env` **before** building:
  ```bash
  NEXT_PUBLIC_API_URL=https://api.yourdomain.com
  ```
  Then build and start:
  ```bash
  cd deploy
  docker compose -f docker-compose.yml build --no-cache
  docker compose -f docker-compose.yml up -d
  ```

- [ ] **Migrations**  
  The API container runs migrations on startup (see `api/docker-entrypoint.sh`). No separate migration step needed.

- [ ] **First run – platform admin**  
  Use the bootstrap token to create the first platform admin (see API or system-admin docs). After that, use system-admin to create tenants and tenant admins.

## 3. Infrastructure (production)

- [ ] **Database**  
  Prefer a managed Postgres service. If using the compose Postgres, ensure backups and retention are configured. Use `DB_SSL=true` and correct `DB_HOST`/credentials when pointing to an external DB.

- [ ] **TLS**  
  Put the stack behind TLS (e.g. Nginx or a cloud load balancer with Let’s Encrypt). Do not expose the API or admin apps on plain HTTP in production.

- [ ] **Cookie security**  
  For production, set `COOKIE_SECURE=true` (or equivalent) so auth cookies are only sent over HTTPS. Ensure system-admin and tenant-admin are served over HTTPS.

- [ ] **Secrets in production**  
  Prefer your platform’s secret manager (e.g. Kubernetes secrets, AWS Secrets Manager) and inject into the API container. The API supports `*_FILE` env vars (e.g. `DB_PASSWORD_FILE`, `JWT_SECRET_FILE`). The entrypoint loads `DB_PASSWORD` from `DB_PASSWORD_FILE` for migrations and schema setup.

## 4. Post-deploy checks

- [ ] **Health**  
  - API: `GET /v1/health` (and `/v1/health/detailed` if implemented) returns 200.
  - System-admin dashboard shows health and links to Health and Alerts.

- [ ] **Logins**  
  - Platform admin can log in to system-admin.
  - Tenant admin can log in to tenant-admin (with correct tenant).
  - CORS allows browser requests from your frontend origins.

- [ ] **Email**  
  Trigger a password reset or verification email and confirm delivery (and check spam).

## 5. Optional hardening

- [ ] **Rate limits**  
  API uses `RATE_LIMIT_TTL` and `RATE_LIMIT_LIMIT`. Tune in `.env` if needed.

- [ ] **MFA**  
  Consider `FORCE_MFA_FOR_ADMINS=true` for platform admins. Use system-admin to enforce tenant-level MFA for admins and drivers.

- [ ] **JWT rotation**  
  Plan rotation of JWT and refresh secrets; after rotation, existing tokens are invalid until users re-login or refresh.

---

**Quick start (local / staging):**

```bash
cd deploy
cp env.example.txt .env
cp -r secrets.example secrets   # then edit secrets/* with real values
docker compose -f docker-compose.yml up -d
# API: http://localhost:3010  System admin: http://localhost:3011  Tenant admin: http://localhost:3012
```
