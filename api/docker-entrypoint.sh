#!/bin/sh
set -e

# Load secrets from Docker *_FILE env vars so standalone scripts and TypeORM data-source get them
if [ -n "$DB_PASSWORD_FILE" ] && [ -r "$DB_PASSWORD_FILE" ]; then
  export DB_PASSWORD=$(cat "$DB_PASSWORD_FILE" | tr -d '\n\r')
fi

# Ensure platform schema exists (required before TypeORM migrations on fresh DB)
node dist/scripts/ensure-platform-schema.js
# Run pending migrations (idempotent)
npx typeorm migration:run -d dist/database/data-source.js
# Start the API
exec node dist/main
