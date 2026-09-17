import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGpsTrackingPoints1700000000029 implements MigrationInterface {
  name = 'AddGpsTrackingPoints1700000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."gps_tracking_points" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "vehicle_id" uuid NULL DEFAULT NULL,
          "vehicle_label" varchar NULL DEFAULT NULL,
          "device_id" varchar NULL DEFAULT NULL,
          "source" varchar NULL DEFAULT 'dashcam',
          "latitude" numeric NOT NULL,
          "longitude" numeric NOT NULL,
          "speed_kph" numeric NULL DEFAULT NULL,
          "heading" numeric NULL DEFAULT NULL,
          "recorded_at" timestamptz NOT NULL,
          "raw_payload" text NULL DEFAULT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now()
        )`,
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
        `DROP TABLE IF EXISTS "${schema}"."gps_tracking_points"`,
      );
    }
  }
}
