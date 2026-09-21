import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Micodus depth: persist JT808 alarm bits / extras, tracking_events stream,
 * overspeed + voltage thresholds on tenant_tracking_settings.
 */
export class AddTrackingEventsAndAlarmDepth1700000000043
  implements MigrationInterface
{
  name = 'AddTrackingEventsAndAlarmDepth1700000000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schemas: string[] = (
      await queryRunner.query(
        `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%'`,
      )
    ).map((r: { nspname: string }) => r.nspname);

    for (const schema of schemas) {
      await queryRunner.query(`
        ALTER TABLE "${schema}"."gps_tracking_points"
          ADD COLUMN IF NOT EXISTS "alarm_flags" bigint NULL,
          ADD COLUMN IF NOT EXISTS "alarm_ext" varchar NULL,
          ADD COLUMN IF NOT EXISTS "gsm_signal" smallint NULL,
          ADD COLUMN IF NOT EXISTS "msg_id" int NULL,
          ADD COLUMN IF NOT EXISTS "can_odometer_km" numeric NULL,
          ADD COLUMN IF NOT EXISTS "can_speed_kph" numeric NULL
      `);

      await queryRunner.query(`
        ALTER TABLE "${schema}"."tenant_tracking_settings"
          ADD COLUMN IF NOT EXISTS "overspeed_kph" numeric NOT NULL DEFAULT 60,
          ADD COLUMN IF NOT EXISTS "low_voltage_threshold" numeric NOT NULL DEFAULT 11.5,
          ADD COLUMN IF NOT EXISTS "offline_minutes" int NOT NULL DEFAULT 15,
          ADD COLUMN IF NOT EXISTS "idle_alert_minutes" int NOT NULL DEFAULT 20
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}"."tracking_events" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "vehicle_id" uuid NULL,
          "device_id" varchar NULL,
          "point_id" uuid NULL,
          "event_type" varchar NOT NULL,
          "severity" varchar NOT NULL DEFAULT 'info',
          "message" text NULL,
          "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
          "latitude" numeric NULL,
          "longitude" numeric NULL,
          "speed_kph" numeric NULL,
          "recorded_at" timestamptz NOT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_tracking_events_recorded"
          ON "${schema}"."tracking_events" ("recorded_at" DESC)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_tracking_events_type"
          ON "${schema}"."tracking_events" ("event_type", "recorded_at" DESC)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_tracking_events_vehicle"
          ON "${schema}"."tracking_events" ("vehicle_id", "recorded_at" DESC)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schemas: string[] = (
      await queryRunner.query(
        `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant_%'`,
      )
    ).map((r: { nspname: string }) => r.nspname);

    for (const schema of schemas) {
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."tracking_events"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${schema}"."gps_tracking_points"
          DROP COLUMN IF EXISTS "alarm_flags",
          DROP COLUMN IF EXISTS "alarm_ext",
          DROP COLUMN IF EXISTS "gsm_signal",
          DROP COLUMN IF EXISTS "msg_id",
          DROP COLUMN IF EXISTS "can_odometer_km",
          DROP COLUMN IF EXISTS "can_speed_kph"
      `);
      await queryRunner.query(`
        ALTER TABLE "${schema}"."tenant_tracking_settings"
          DROP COLUMN IF EXISTS "overspeed_kph",
          DROP COLUMN IF EXISTS "low_voltage_threshold",
          DROP COLUMN IF EXISTS "offline_minutes",
          DROP COLUMN IF EXISTS "idle_alert_minutes"
      `);
    }
  }
}
