import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Driver panic / incident alerts for tenant admins.
 */
export class AddIncidentsPanic1700000000046 implements MigrationInterface {
  name = 'AddIncidentsPanic1700000000046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."incidents" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "driver_id" uuid NOT NULL,
          "vehicle" varchar NULL,
          "lat" double precision NULL,
          "lng" double precision NULL,
          "note" text NULL,
          "status" varchar NOT NULL DEFAULT 'open',
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "acked_at" timestamptz NULL,
          "acked_by" uuid NULL,
          "closed_at" timestamptz NULL
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_incidents_status_created"
           ON "${schema}"."incidents" ("status", "created_at" DESC)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_incidents_driver"
           ON "${schema}"."incidents" ("driver_id", "created_at" DESC)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `DROP INDEX IF EXISTS "${schema}"."idx_incidents_driver"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "${schema}"."idx_incidents_status_created"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."incidents"`,
      );
    }
  }
}
