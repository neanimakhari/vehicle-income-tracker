# Agent / remote deploy (selective services)

Use this when you want Cursor (or anyone) to redeploy **without SSHing manually**.

## 1. One-time GitHub secrets

In the GitHub repo → **Settings → Secrets and variables → Actions**, set:

| Secret | Example | Purpose |
|--------|---------|---------|
| `DROPLET_HOST` | `104.248.x.x` or hostname | Droplet IP/DNS |
| `DROPLET_USERNAME` | `root` | SSH user |
| `DROPLET_SSH_PRIVATE_KEY` | full private key PEM | Deploy key with access to the droplet |

Optional on the droplet (already defaulted in the workflow):

- App path: `/opt/vehicle_income_tracker`
- Droplet must already have `deploy/.env` and `deploy/secrets/` (never store those in GitHub)

The SSH key must be able to run `git pull` and `docker compose` on the droplet.

## 2. Pick what to deploy

Edit [`redeploy.targets`](./redeploy.targets):

```text
SERVICES=tenant-admin
```

Or use aliases / lists:

```text
SERVICES=vit-admin
SERVICES=platform
SERVICES=api,tenant-admin
SERVICES=all
```

| You want | Set `SERVICES` to |
|----------|-------------------|
| Tenant admin (vit-admin) | `tenant-admin` or `vit-admin` |
| Platform admin (vit-platform) | `system-admin` or `platform` |
| API (vit-api) | `api` |
| Everything | `all` |

## 3. How the agent deploys

After secrets exist, the agent runs (from the repo):

```bash
gh workflow run deploy.yml -f services=tenant-admin -f ref=main
# or
gh workflow run deploy.yml -f services=system-admin
gh workflow run deploy.yml -f services=api
gh workflow run deploy.yml -f services=all
```

Then watches the run:

```bash
gh run list --workflow=deploy.yml --limit 3
gh run watch
```

You can also start it in GitHub → **Actions → Deploy to DigitalOcean Droplet → Run workflow**.

## 4. Manual on the droplet (fallback)

```bash
cd /opt/vehicle_income_tracker
git pull
cd deploy
./redeploy.sh --services tenant-admin
# or rely on redeploy.targets:
./redeploy.sh
```

## 5. What you still do once

1. Add the three GitHub secrets above (if not already present).
2. Ensure the droplet repo remote can `git pull` (deploy key or HTTPS token).
3. Install GitHub CLI locally **or** let the agent use the Actions UI / API — for Cursor to trigger deploys unattended, `gh` auth on the machine (or a PAT with `actions:write`) is enough; you never need to SSH for routine redeploys.
