/**
 * Creates the "platform" schema if it does not exist.
 * Run this before migration:run when using a fresh database (e.g. Docker),
 * since TypeORM creates the migrations table in the configured schema before running any migration.
 */
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'vit_platform',
  });
  try {
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS "platform"');
    console.log('Schema "platform" is ready.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
