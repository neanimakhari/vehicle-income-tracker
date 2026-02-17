import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPlatform1700000000000 implements MigrationInterface {
  name = 'InitPlatform1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "platform"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL UNIQUE,
        "slug" varchar NOT NULL UNIQUE,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."auth_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "role" varchar NOT NULL,
        "tenant_id" varchar NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" varchar NOT NULL,
        "actor_user_id" varchar NULL,
        "actor_role" varchar NULL,
        "target_type" varchar NULL,
        "target_id" varchar NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."auth_users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."tenants"`);
  }
}



