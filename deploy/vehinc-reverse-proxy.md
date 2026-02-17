# Reverse proxy for vehinc.co.za

Docker Compose exposes the apps on **host** ports 3020, 3021, 3022. Point each subdomain to the correct port.

## Port mapping

| Subdomain | Service        | Host port | Container (internal) |
|-----------|----------------|-----------|----------------------|
| **vit-api.vehinc.co.za**      | API            | 3020 | 3000 |
| **vit-platform.vehinc.co.za** | System Admin   | 3021 | 3001 |
| **vit-admin.vehinc.co.za**   | Tenant Admin   | 3022 | 3002 |

## Nginx (example)

On the server, proxy each subdomain to `127.0.0.1:PORT` and enable HTTPS (e.g. Let’s Encrypt). Example snippets:

```nginx
# vit-api.vehinc.co.za → 3020
server {
    listen 443 ssl;
    server_name vit-api.vehinc.co.za;
    # ssl_certificate /path/to/fullchain.pem;
    # ssl_certificate_key /path/to/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# vit-platform.vehinc.co.za → 3021 (System Admin)
server {
    listen 443 ssl;
    server_name vit-platform.vehinc.co.za;
    location / {
        proxy_pass http://127.0.0.1:3021;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# vit-admin.vehinc.co.za → 3022 (Tenant Admin)
server {
    listen 443 ssl;
    server_name vit-admin.vehinc.co.za;
    location / {
        proxy_pass http://127.0.0.1:3022;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Redirect HTTP → HTTPS if your panel doesn’t do it:

```nginx
server {
    listen 80;
    server_name vit-api.vehinc.co.za vit-platform.vehinc.co.za vit-admin.vehinc.co.za;
    return 301 https://$host$request_uri;
}
```

## cPanel / Document roots

If your panel shows **Document Root** (e.g. `/public_html/vit-api.vehinc.co.za`), you usually have two options:

1. **Proxy from the docroot**  
   Configure the subdomain to use a proxy (e.g. “Reverse Proxy” or “Application”) to `http://127.0.0.1:3020` (and 3021, 3022 for the others). Document root is then irrelevant for the app.

2. **Nginx/Apache in front**  
   Ignore the docroot for these three subdomains and define virtual hosts that proxy to 3020, 3021, 3022 as in the Nginx example above.

After proxy and HTTPS are in place, open:

- **https://vit-platform.vehinc.co.za** — Platform admin  
- **https://vit-admin.vehinc.co.za** — Tenant admin  
- **https://vit-api.vehinc.co.za/v1/health** — API health check  
