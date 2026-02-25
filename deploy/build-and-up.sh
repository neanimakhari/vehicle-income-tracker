#!/usr/bin/env bash
# Build and start the stack from deploy/ so .env is loaded and NEXT_PUBLIC_API_URL
# is baked into the frontends. Run from repo root: ./deploy/build-and-up.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  echo "Missing deploy/.env. Copy deploy/env.example.txt to deploy/.env and set NEXT_PUBLIC_API_URL and CORS_ORIGINS."
  exit 1
fi

# Require NEXT_PUBLIC_API_URL to be set and non-empty (frontends need it)
if ! grep -qE '^NEXT_PUBLIC_API_URL=.+' .env 2>/dev/null; then
  echo "Error: set NEXT_PUBLIC_API_URL in deploy/.env (e.g. https://vit-api.vehinc.co.za or http://YOUR_IP:4000)."
  exit 1
fi
if ! grep -q '^NEXT_PUBLIC_API_URL=https://' .env 2>/dev/null; then
  echo "Note: NEXT_PUBLIC_API_URL is not https. Use https in production behind Nginx."
fi

echo "Building from deploy/ (so .env is used)..."
docker compose -f docker-compose.yml build --no-cache

echo "Starting containers..."
docker compose -f docker-compose.yml up -d

echo "Done. API and frontends should be up. Check with: docker compose -f deploy/docker-compose.yml ps"
