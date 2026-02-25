# Connect subdomains to the droplet (keep IP access)

Use this to point **vit-api**, **vit-platform**, and **vit-admin**.vehinc.co.za at your droplet. Your existing **IP-based access** (e.g. `http://104.248.42.192:4000`) stays as-is; this only adds domain-based access.

---

## 1. DNS at your domain provider

Where **vehinc.co.za** is managed (registrar, cPanel, Cloudflare, etc.):

Add **3 A records** with your **droplet IP** (replace with your actual IP if different):

| Type | Name / Host   | Value            | TTL  |
|------|---------------|------------------|------|
| A    | vit-api       | `104.248.42.192` | 300  |
| A    | vit-platform  | `104.248.42.192` | 300  |
| A    | vit-admin     | `104.248.42.192` | 300  |

- **vit-api.vehinc.co.za** → droplet  
- **vit-platform.vehinc.co.za** → droplet  
- **vit-admin.vehinc.co.za** → droplet  

Some panels use “Host” or “Subdomain” instead of “Name”; use `vit-api`, `vit-platform`, `vit-admin` (no `.vehinc.co.za`).

Save the records. Propagation is often 5–15 minutes.

**Check from your machine:**

```bash
dig vit-api.vehinc.co.za +short
dig vit-platform.vehinc.co.za +short
dig vit-admin.vehinc.co.za +short
```

Each should print your droplet IP (`104.248.42.192`).

---

## 2. Nginx on the droplet (HTTP first)

SSH into the droplet:

```bash
ssh root@104.248.42.192
```

Install Nginx and Certbot if not already installed:

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx
```

Create a site that serves the **three hostnames** and proxies to your **existing ports** (4000, 4001, 4002). IP access is unchanged.

```bash
cat > /etc/nginx/sites-available/vit << 'EOF'
# Subdomains → same app (IP ports 4000/4001/4002 unchanged)
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

Open firewall for HTTP/HTTPS if needed:

```bash
ufw allow 80
ufw allow 443
ufw status
```

After DNS has propagated, in a browser you should get a plain “ok” at:

- http://vit-api.vehinc.co.za  
- http://vit-platform.vehinc.co.za  
- http://vit-admin.vehinc.co.za  

**IP access still works:** `http://104.248.42.192:4000`, `:4001`, `:4002` are unchanged.

---

## 3. Get HTTPS certificates (Let’s Encrypt)

On the droplet:

```bash
certbot --nginx -d vit-api.vehinc.co.za -d vit-platform.vehinc.co.za -d vit-admin.vehinc.co.za
```

Use your email when asked; agree to terms. Certbot will configure Nginx for HTTPS.

---

## 4. Nginx: proxy subdomains to your app (HTTPS)

After Certbot, replace the “ok” placeholder with the real proxy config. Cert paths may be one directory per domain or one for all three; check:

```bash
ls /etc/letsencrypt/live/
```

If you see **one** folder (e.g. `vit-api.vehinc.co.za`), use that path for all three `ssl_certificate` / `ssl_certificate_key` below. If you see three folders, use the matching names.

```bash
# If one cert for all three, set:
CERT_DIR=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | head -1)

# Then create the full proxy config:
cat > /etc/nginx/sites-available/vit << 'NGINXEOF'
# vit-api.vehinc.co.za → 127.0.0.1:4000 (IP :4000 unchanged)
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
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# vit-platform.vehinc.co.za (System Admin) → 127.0.0.1:4001
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
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# vit-admin.vehinc.co.za (Tenant Admin) → 127.0.0.1:4002
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
        proxy_pass http://127.0.0.1:4002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF
```

If Certbot created **one** certificate for all three names, the paths might all be the same directory. Check:

```bash
ls /etc/letsencrypt/live/
```

If you only see e.g. `vit-api.vehinc.co.za`, then in the config above use that path for all six `ssl_certificate` / `ssl_certificate_key` lines (e.g. `/etc/letsencrypt/live/vit-api.vehinc.co.za/...` for every server block). Then:

```bash
nginx -t && systemctl reload nginx
```

---

## 5. Use domains in app config (when ready)

- In **deploy/.env** you can set:
  - `NEXT_PUBLIC_API_URL=https://vit-api.vehinc.co.za`
  - `CORS_ORIGINS=https://vit-platform.vehinc.co.za,https://vit-admin.vehinc.co.za`
  Then rebuild frontends so the UIs use the domains. **Keep** your current IP values in `.env` until you’re happy with the domains; you can switch later.
- **Flutter app:** when you want the app to use the API via domain, rebuild with:
  `flutter build apk --dart-define=API_BASE_URL=https://vit-api.vehinc.co.za`

---

## Summary

| What | Action |
|------|--------|
| **DNS** | 3 A records: `vit-api`, `vit-platform`, `vit-admin` → `104.248.42.192` |
| **Droplet / Docker** | No change. Ports 4000, 4001, 4002 stay as they are (IP access still works). |
| **Nginx** | Listens on 80/443 for the three hostnames, proxies to 127.0.0.1:4000, 4001, 4002. |
| **HTTPS** | Certbot + the config above so https://vit-api.vehinc.co.za etc. work. |

After DNS has propagated and Nginx is configured, both of these work:

- **By IP:** `http://104.248.42.192:4000`, `:4001`, `:4002`  
- **By domain:** `https://vit-api.vehinc.co.za`, `https://vit-platform.vehinc.co.za`, `https://vit-admin.vehinc.co.za`
