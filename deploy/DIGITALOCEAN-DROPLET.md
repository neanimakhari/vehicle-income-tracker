# Deploy VIT on a DigitalOcean Droplet (domains at your provider)

Your app runs in **Docker on a DigitalOcean Droplet**. The three subdomains (**vit-api**, **vit-platform**, **vit-admin**.vehinc.co.za) are managed at **your DNS provider** and point to the droplet’s IP. Nginx on the droplet handles HTTPS and reverse proxy.

---

## 1. DNS at your domain provider

At whoever hosts **vehinc.co.za** (e.g. domain registrar, cPanel, Cloudflare):

Create **3 A records** pointing to your **Droplet’s public IP**:

| Type | Name / Host      | Value           | TTL  |
|------|------------------|-----------------|------|
| A    | vit-api          | `<DROPLET_IP>`  | 300  |
| A    | vit-platform     | `<DROPLET_IP>`  | 300  |
| A    | vit-admin        | `<DROPLET_IP>`  | 300  |

So you get:

- **vit-api.vehinc.co.za** → Droplet  
- **vit-platform.vehinc.co.za** → Droplet  
- **vit-admin.vehinc.co.za** → Droplet  

(If your provider uses “subdomain” instead of “name”, use `vit-api`, `vit-platform`, `vit-admin`.)

Wait for DNS to propagate (often 5–15 minutes). Check with:

```bash
dig vit-api.vehinc.co.za +short
```

---

## 2. Prepare the DigitalOcean Droplet

- **Image:** Ubuntu 22.04 LTS (or 24.04).  
- **Size:** Basic 1 GB RAM is enough to start; 2 GB is safer for production.  
- **SSH:** Add your SSH key in the DO dashboard.

After creation, SSH in:

```bash
ssh root@<DROPLET_IP>
```

### 2.1 Install Docker and Docker Compose

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.2 Install Nginx and Certbot (Let’s Encrypt)

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 2.3 Firewall (optional but recommended)

Allow SSH, HTTP, HTTPS. Do **not** expose 3020, 3021, 3022 to the internet; Nginx will proxy to them on localhost.

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
ufw status
```

---

## 3. Deploy the app on the droplet

### 3.1 Get the code on the droplet

Either clone (if the repo is public or you use a deploy key):

```bash
cd /opt
git clone <YOUR_REPO_URL> vehicle_income_tracker
cd vehicle_income_tracker
```

Or upload the project (e.g. `rsync` or SFTP) into `/opt/vehicle_income_tracker` so the `deploy` folder and `api`, `system-admin`, `tenant-admin` directories are there.

### 3.2 Secrets and environment

```bash
cd /opt/vehicle_income_tracker/deploy

cp env.vehinc.example.txt .env
cp -r secrets.example secrets
```

Edit the secret files with strong values (no newlines inside the file):

```bash
nano secrets/postgres_password.txt   # one line, strong password
nano secrets/jwt_secret.txt          # min 16 chars
nano secrets/jwt_refresh_secret.txt  # min 16 chars
nano secrets/bootstrap_token.txt    # token for first platform admin
```

Edit `.env` and set Mailgun (or SMTP) if you use email:

```bash
nano .env
```

The vehinc example already sets:

- `NEXT_PUBLIC_API_URL=https://vit-api.vehinc.co.za`
- `CORS_ORIGINS=https://vit-platform.vehinc.co.za,https://vit-admin.vehinc.co.za`
- `API_PORT=3020`, `SYSTEM_ADMIN_PORT=3021`, `TENANT_ADMIN_PORT=3022`
- `COOKIE_SECURE=true`

### 3.3 Build and run (ports only on localhost)

So that only Nginx can reach the app, bind the app ports to 127.0.0.1. From the same `deploy` directory, create an override file:

```bash
cat > docker-compose.override.yml << 'EOF'
services:
  api:
    ports:
      - "127.0.0.1:3020:3000"
  system-admin:
    ports:
      - "127.0.0.1:3021:3001"
  tenant-admin:
    ports:
      - "127.0.0.1:3022:3002"
EOF
```

Then build and start:

```bash
docker compose -f docker-compose.yml build --no-cache
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml ps
```

Containers listen on 3020, 3021, 3022 on **localhost only**; the firewall does not need to open those ports.

---

## 4. Nginx + HTTPS on the droplet

Certbot will get certificates and adjust Nginx. First, give Nginx a minimal config so the three hostnames are served (HTTP only for the first run):

```bash
cat > /etc/nginx/sites-available/vit << 'EOF'
server {
    listen 80;
    server_name vit-api.vehinc.co.za vit-platform.vehinc.co.za vit-admin.vehinc.co.za;
    location / {
        return 200 'ok';
        add_header Content-Type text/plain;
    }
}
EOF

ln -sf /etc/nginx/sites-available/vit /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Get certificates (Certbot will prompt for email and agree to terms):

```bash
certbot --nginx -d vit-api.vehinc.co.za -d vit-platform.vehinc.co.za -d vit-admin.vehinc.co.za
```

Then replace the config with the real proxy (and HTTPS):

```bash
cat > /etc/nginx/sites-available/vit << 'EOF'
# vit-api.vehinc.co.za
server {
    listen 80;
    server_name vit-api.vehinc.co.za;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name vit-api.vehinc.co.za;
    ssl_certificate /etc/letsencrypt/live/vit-api.vehinc.co.za/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vit-api.vehinc.co.za/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# vit-platform.vehinc.co.za (System Admin)
server {
    listen 80;
    server_name vit-platform.vehinc.co.za;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name vit-platform.vehinc.co.za;
    ssl_certificate /etc/letsencrypt/live/vit-platform.vehinc.co.za/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vit-platform.vehinc.co.za/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    location / {
        proxy_pass http://127.0.0.1:3021;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# vit-admin.vehinc.co.za (Tenant Admin)
server {
    listen 80;
    server_name vit-admin.vehinc.co.za;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name vit-admin.vehinc.co.za;
    ssl_certificate /etc/letsencrypt/live/vit-admin.vehinc.co.za/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vit-admin.vehinc.co.za/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    location / {
        proxy_pass http://127.0.0.1:3022;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

If Certbot issued **one** cert for all three names, the paths might be a single directory (e.g. `/etc/letsencrypt/live/vit-api.vehinc.co.za/`). Check:

```bash
ls /etc/letsencrypt/live/
```

If you see one folder (e.g. `vit-api.vehinc.co.za`), use that same path for all three `ssl_certificate` / `ssl_certificate_key` lines. Then:

```bash
nginx -t && systemctl reload nginx
```

---

## 5. Check that everything works

- **https://vit-api.vehinc.co.za/v1/health** — API health  
- **https://vit-platform.vehinc.co.za** — Platform admin login  
- **https://vit-admin.vehinc.co.za** — Tenant admin login  

Create the first platform admin using the bootstrap token (see main README or API docs).

---

## 6. Summary

| Where           | What |
|----------------|------|
| **Your DNS provider** | 3 A records: `vit-api`, `vit-platform`, `vit-admin` → Droplet IP |
| **DigitalOcean Droplet** | Ubuntu, Docker, Nginx, Certbot, UFW (22, 80, 443) |
| **App**         | In `/opt/vehicle_income_tracker`, `deploy/.env` + `deploy/secrets/`, ports 3020/3021/3022 bound to **127.0.0.1** |
| **Nginx**       | Proxies each subdomain to localhost and serves HTTPS via Let’s Encrypt |

The domains stay with your provider; only the A records point to the droplet.
