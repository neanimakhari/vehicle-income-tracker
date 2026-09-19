# VIT private app store (`vit-app.vehinc.co.za`)

Public download page + APK hosting for sideloaded Android builds and in-app update checks.

Drivers use a **per-tenant path**: `https://vit-app.vehinc.co.za/{slug}` (same idea as tenant-admin). There is no company dropdown on the page.

## DNS

Create an **A** record:

| Host | Type | Value |
|------|------|--------|
| `vit-app` | A | *(same IP as vit-api / vit-admin droplet)* |

## On the droplet

```bash
mkdir -p /var/www/vit-app/releases
# Place branded index.html and latest.json (see deploy/vit-app/)
```

Nginx server block (TLS after certbot):

```nginx
server {
  listen 80;
  server_name vit-app.vehinc.co.za;
  root /var/www/vit-app;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /releases/ {
    autoindex off;
    add_header Cache-Control "public, max-age=300";
  }
}
```

Then:

```bash
certbot --nginx -d vit-app.vehinc.co.za
```

## Manifest

`/releases/latest.json` must match the APK `versionName` / `versionCode` published under `/releases/`.

The API also exposes `GET /v1/public/mobile-app/latest` (same payload) so the Flutter app can keep using `vit-api`.
