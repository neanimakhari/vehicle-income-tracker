# Vehicle Income Tracker (VIT)

Run the full platform with Docker, then use the web UIs or mobile app to manage tenants, drivers, and income.

## Quick start (Docker)

From the project root:

```bash
docker compose up --build
```

- **API:** http://localhost:3000 (routes are under `/v1`, e.g. `/v1/health`, `/v1/auth/login`)  
- **Tenant admin:** http://localhost:3002  
- **System admin:** http://localhost:3001  

Optional: create a `.env` in the project root for Postgres/JWT/bootstrap. For email, configure **`api/.env`** (the API container loads it); use `api/config/env.example.txt` as a template.

**Build without cache (clean build):**

```bash
# Docker: rebuild all images from scratch (no layer cache)
docker compose build --no-cache

# Then start
docker compose up --build -d
```

For a single app (e.g. system-admin only):

```bash
docker compose build --no-cache system-admin
```

Local builds (no Docker) – clear caches then build:

```bash
# Next.js (system-admin / tenant-admin): remove .next and node_modules/.cache
rm -rf system-admin/.next system-admin/node_modules/.cache
cd system-admin && npm run build

# Nest (API): clean and rebuild
cd api && rm -rf dist && npm run build
```

**Open-source cache and build tooling (optional):**

- **Docker layer cache** – Default; use `docker compose build --no-cache` when you need a clean build.
- **Turborepo** – Monorepo task runner with remote and local caching: [turborepo.com](https://turbo.build/repo). Good if you add more apps/packages and want shared cache.
- **Nx** – Monorepo and build cache (local + optional Nx Cloud): [nx.dev](https://nx.dev). More features (graph, affected, CI cache).
- **Next.js** – Already caches in `.next/cache`; clearing `.next` gives a clean build.
- **Redis** – For application-level cache (sessions, API responses), not build cache: [redis.io](https://redis.io).

### Email (API)

The API sends email for password reset, verification, reports, and notifications.

**Option A – Mailgun HTTP API (recommended)**  
In `api/.env` set:
- `MAILGUN_API_KEY` – from Mailgun Dashboard → Sending → API keys
- `MAILGUN_DOMAIN` – your sending domain (e.g. `sandbox...mailgun.org`)
- `EMAIL_FROM` – e.g. `Mailgun Sandbox <postmaster@...mailgun.org>`

**Option B – SMTP**  
Set `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` (e.g. Mailgun SMTP: `smtp.mailgun.org`, 587). See `api/config/env.example.txt`.

**App URLs (links in emails):**

| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` | Tenant-admin / driver web (reset, verify links) | `http://localhost:3002` |
| `TENANT_ADMIN_APP_URL` | Tenant admin app (admin reset links) | same as `FRONTEND_URL` |
| `SYSTEM_ADMIN_APP_URL` | System admin app (platform admin reset) | `http://localhost:3001` |
| `DRIVER_APP_URL` | Optional: driver app deep link base (e.g. `vitapp://`) so reset/verify emails open the mobile app |

If neither Mailgun nor SMTP is configured, the API skips sending (logs a warning) and the app still runs.

**Migrations:** The API container runs DB migrations automatically on startup. You only need to run seed once (or after a fresh DB).

### First-time: seed the database

After the stack is up, seed to create the demo tenant and users:

```bash
docker compose run --rm api npm run seed:platform:prod
```

To create an **additional** platform admin, pass env vars (from the `deploy` directory):

```bash
docker compose run --rm -e SEED_EXTRA_PLATFORM_ADMIN_EMAIL=your@email.com -e "SEED_EXTRA_PLATFORM_ADMIN_PASSWORD=YourPassword#" api npm run seed:platform:prod
```

If you see "Missing script", rebuild the API image: `docker compose build api`

---

## Platform passwords (after seed)

| Role            | Email                     | Password       | Where to use                    |
|-----------------|---------------------------|----------------|----------------------------------|
| **Platform admin** | platform.admin@vit.local  | **ChangeMe123!** | System admin: http://localhost:3001 |
| **Tenant admin**  | tenant.admin@vit.local   | **ChangeMe123!** | Tenant admin: http://localhost:3002 |
| **Demo driver**   | driver.demo@vit.local    | **ChangeMe123!** | Mobile app (tenant ID: **demo**)  |

Seed creates tenant **demo** and the three users above.

### "Tenant not found or not set up" / tenants missing

**Nothing in the app deletes tenants.** That message means the database has no tenant (or no schema for that tenant). Common causes:

1. **Docker volume was removed** – If you ran `docker compose down -v`, the `vit_pgdata` volume is deleted and all data (tenants, users) is gone. Avoid `-v` if you want to keep data.
2. **Migrations or seed were never run** – After first `docker compose up`, you must run migrations and seed (see above).
3. **New or recreated database** – Any time the DB is recreated (new volume, new host), run migrations and seed again.

**Fix:** With the stack running, run:

```bash
docker compose run --rm api npm run migration:run:prod
docker compose run --rm api npm run seed:platform:prod
```

Then log in with tenant **demo** and **driver.demo@vit.local** / **ChangeMe123!**.

---

## Docker defaults (no `.env`)

| Setting              | Default value                          |
|----------------------|----------------------------------------|
| Postgres user        | `vit_admin`                            |
| Postgres password    | `vit_secret_change_me`                 |
| JWT secret           | `change-me-jwt-secret-min-32-chars`    |
| JWT refresh secret   | `change-me-refresh-secret-min-32`      |

---

## Mobile app with Docker backend

The app defaults to **http://10.0.2.2:3000** (Android emulator). On Windows, use your PC’s LAN IP instead.

1. Ensure the API is up: open http://localhost:3000/v1/health
2. Get your PC’s IPv4 address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. Run the app:

   ```bash
   cd app
   flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:3000/v1
   ```

   Example: `flutter run --dart-define=API_BASE_URL=http://192.168.0.105:3000/v1`

- **Physical device:** use the same PC IP in `API_BASE_URL` (e.g. `http://192.168.0.105:3000/v1`)
- **Firewall:** allow inbound TCP on port 3000 if needed

---

## Accessibility (Userway)

The system-admin and tenant-admin web apps can show the Userway accessibility widget. To enable it, set **`NEXT_PUBLIC_USERWAY_ACCOUNT_ID`** in the environment used to build each app (e.g. in `system-admin/.env.local` and `tenant-admin/.env.local`, or in your deploy build args). Get your account ID from [Userway](https://userway.org). If unset, the widget script is not loaded.

---

## Deployment

For production (e.g. DigitalOcean droplet):

1. Use the **deploy** stack: `docker compose -f deploy/docker-compose.yml up -d --build`
2. Copy `deploy/env.example.txt` → `deploy/.env` and `deploy/secrets.example/` → `deploy/secrets/`, then set production values (see `deploy/env.production.example.txt`).
3. Set `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` to your production domain before building.
4. Default host ports are 3010 (API), 3011 (system admin), 3012 (tenant admin). Put Nginx (or similar) in front with SSL.

See **`deploy/README.md`** for full details.

---

## Database indexing, performance, and scalability

This section captures how to keep Postgres fast as data grows, and how to scale out / add failover safely.

### Indexing strategy (Postgres)

- **General rules**
  - **Always index:**
    - Primary keys (`id` on all entities – already covered by TypeORM).
    - All `FOREIGN KEY` columns (e.g. `tenant_id`, `vehicle_id`, `driver_id`, `income_id`, `created_by_id`).
    - Columns used in **joins** or frequent `WHERE` filters / `ORDER BY`.
  - **Avoid over-indexing:** every extra index slows down writes. Only add indexes you actually use in queries.

- **Recommended indexes by module**
  - **Tenant and users**
    - `platform.tenants.slug` (unique index – already present).
    - `tenant_*.users.email` (unique index – already present).
    - Add (if not already in migrations):
      - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified ON tenant_*.users(email_verified);`
      - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_created_at ON tenant_*.users(created_at);`
  - **Incomes / trips**
    - Typical queries: by tenant, by vehicle, by driver, recent first, by date range.
    - For each tenant schema (`tenant_xxx`), ensure:
      - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incomes_vehicle_date ON incomes(vehicle_label, date);`
      - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incomes_driver_date ON incomes(driver_id, date);`
      - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incomes_created_at ON incomes(created_at DESC);`
  - **Maintenance / alerts**
    - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_maintenance_vehicle_due_date ON maintenance_tasks(vehicle_id, due_date);`
    - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_tenant_created_at ON alerts(created_at DESC);`
  - **Audit logs**
    - Used for tenant / platform history views and debugging.
    - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_tenant_created_at ON audit_logs(tenant_id, created_at DESC);`
    - `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id, actor_role);`

- **How to add indexes safely in production**
  - Use **concurrent** indexes so you don’t lock tables for writes:
    - `CREATE INDEX CONCURRENTLY ...` (you can run via a migration or manual SQL).
  - For long-running or large-table changes, prefer:
    - New migration using TypeORM’s `queryRunner.query('CREATE INDEX CONCURRENTLY ...')`.
    - Run during low-traffic windows if you expect multi-million-row tables.

### Partitioning and large-tenant strategy

If any single tenant (fleet) becomes very large (millions of incomes):

- **Time-based partitioning**
  - Partition `incomes` and `maintenance_tasks` by **month** or **year** on `date`.
  - Benefits: faster queries for recent data, easier archival of old data.
  - Approach:
    - Introduce parent table `incomes` + child tables `incomes_2026_01`, etc. in each `tenant_*` schema.
    - Use Postgres declarative partitioning (`PARTITION BY RANGE (date)`).
  - Start with **monthly partitions** once a single table exceeds ~5–10 million rows.

- **Archiving**
  - For very old data (e.g. > 3 years), consider:
    - Moving partitions to cheaper storage or a separate reporting DB.
    - Expose an “Export to CSV” or “Archive” function in system-admin to offload old periods.

### Scaling reads and writes (replicas, failover)

- **Single primary with read replica**
  - Use **managed Postgres** (e.g. DigitalOcean Managed DB, AWS RDS, etc.) with:
    - 1 primary (read/write).
    - 1+ read replicas for heavy reporting / analytics.
  - App changes:
    - Keep **all writes** and OLTP queries on the primary (current behavior).
    - For heavy, read-only endpoints (e.g. monthly reports, long audit log queries), you can:
      - Configure a second TypeORM `DataSource` pointing to the replica, or
      - Use a reporting worker / cron job that connects to the replica for reports.

- **Failover**
  - If you use a managed DB:
    - Enable **automatic failover**; the connection string stays the same and VIT only sees a short outage.
  - If self-managed Postgres:
    - Recommended: use a tool like **Patroni** or a managed service instead of hand-rolling replication.
    - Ensure the **connection string in `deploy/.env`** points at a virtual IP / HA proxy (e.g. HAProxy, pgBouncer) that can fail over to a new primary.

### Application-level scalability

- **API (NestJS)**
  - Stateless; can scale horizontally:
    - Run multiple `api` containers behind Nginx.
    - Keep **sessions authless** (JWT) and avoid sticky sessions.
  - For heavy workloads:
    - Enable **Node.js clustering** or scale Docker replicas: `docker compose up -d --scale api=3` (adjust nginx upstreams).

- **Next.js apps (system-admin, tenant-admin)**
  - Mostly server-rendered/edge-friendly:
    - Can scale with more `system-admin` / `tenant-admin` containers behind Nginx.
  - Ensure:
    - Static assets are cached at the CDN / Nginx level.
    - `NEXT_PUBLIC_API_URL` always points at the load-balanced API endpoint.

- **Background jobs and reports**
  - For expensive monthly or per-tenant reports:
    - Use a **job queue** (e.g. BullMQ + Redis).
    - Store report snapshots per tenant instead of recalculating on every request.

### Monitoring and capacity planning

- **What to watch**
  - Postgres:
    - CPU, RAM, disk I/O, connections.
    - Slow queries (`pg_stat_statements`) – use this to decide which indexes to add.
  - App:
    - API latency (P95/P99) per endpoint.
    - Error rates (500s, DB timeouts).
  - Disk:
    - Docker images + volumes growth (run `docker system df` regularly, prune unused images).

- **Simple process**
  - Start with:
    - A single Postgres instance (managed if possible).
    - One API container, one system-admin, one tenant-admin.
  - As load grows:
    1. Add **indexes** based on slow queries.
    2. Scale **API and web containers** horizontally.
    3. Move to **managed Postgres with read replica**.
    4. Introduce **partitioning / archiving** for the biggest tables.

This README section should give you a clear path from “small single-database deployment” to “multi-tenant system with replicas, failover, and large datasets” without re-architecting the whole app.
