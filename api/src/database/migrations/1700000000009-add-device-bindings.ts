import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceBindings1700000000009 implements MigrationInterface {
  name = 'AddDeviceBindings1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."device_bindings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" varchar NOT NULL,
        "user_role" varchar NOT NULL,
        "tenant_id" varchar NULL,
        "device_id" varchar NOT NULL,
        "device_name" varchar NULL,
        "push_token" varchar NULL,
        "is_trusted" boolean NOT NULL DEFAULT false,
        "last_seen_at" timestamptz NULL DEFAULT NULL,
        "revoked_at" timestamptz NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "user_role", "tenant_id", "device_id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."device_bindings"`,
    );
  }
}

