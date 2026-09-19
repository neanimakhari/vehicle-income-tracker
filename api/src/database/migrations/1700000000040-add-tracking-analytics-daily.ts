import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Daily tracker analytics rollups + income day reconciliation tables (per tenant).
 */
export class AddTrackingAnalyticsDaily1700000000040
  implements MigrationInterface
{
  name = 'AddTrackingAnalyticsDaily1700000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}"."vehicle_tracking_daily" (
          "day" date NOT NULL,
          "vehicle_id" uuid NOT NULL,
          "vehicle_label" varchar NULL,
          "point_count" int NOT NULL DEFAULT 0,
          "distance_km" numeric NULL,
          "distance_basis" varchar NULL,
          "moving_seconds" int NOT NULL DEFAULT 0,
          "idle_seconds" int NOT NULL DEFAULT 0,
          "ignition_on_seconds" int NOT NULL DEFAULT 0,
          "idle_pct" numeric NULL,
          "utilisation_hours" numeric NULL,
          "avg_speed_moving" numeric NULL,
          "max_speed_kph" numeric NULL,
          "stop_count" int NOT NULL DEFAULT 0,
          "estimated_litres" numeric NULL,
          "litres_per_100km" numeric NULL,
          "km_per_litre" numeric NULL,
          "avg_fuel_rate_moving" numeric NULL,
          "fuel_level_start" numeric NULL,
          "fuel_level_end" numeric NULL,
          "avg_rpm_moving" numeric NULL,
          "avg_load_moving" numeric NULL,
          "coolant_max" numeric NULL,
          "coolant_hot_seconds" int NOT NULL DEFAULT 0,
          "high_rpm_low_speed_pct" numeric NULL,
          "avg_external_voltage" numeric NULL,
          "min_external_voltage" numeric NULL,
          "low_voltage_pct" numeric NULL,
          "avg_backup_battery" numeric NULL,
          "gps_fix_ok_pct" numeric NULL,
          "avg_satellites" numeric NULL,
          "overspeed_sample_count" int NOT NULL DEFAULT 0,
          "overspeed_moving_pct" numeric NULL,
          "obd_coverage_pct" numeric NULL,
          "confidence" varchar NOT NULL DEFAULT 'unavailable',
          "include_simulate" boolean NOT NULL DEFAULT false,
          "computed_at" timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY ("day", "vehicle_id")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_vehicle_tracking_daily_day"
        ON "${schema}"."vehicle_tracking_daily" ("day" DESC)
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schema}"."vehicle_day_reconciliation" (
          "day" date NOT NULL,
          "vehicle_id" uuid NOT NULL,
          "vehicle_label" varchar NULL,
          "income_total" numeric NOT NULL DEFAULT 0,
          "income_petrol_litres" numeric NOT NULL DEFAULT 0,
          "income_petrol_rand" numeric NOT NULL DEFAULT 0,
          "income_distance_km" numeric NOT NULL DEFAULT 0,
          "income_entry_count" int NOT NULL DEFAULT 0,
          "tracker_distance_km" numeric NULL,
          "tracker_estimated_litres" numeric NULL,
          "distance_gap_pct" numeric NULL,
          "fuel_gap_pct" numeric NULL,
          "rand_per_tracker_km" numeric NULL,
          "income_per_km" numeric NULL,
          "income_per_ignition_hour" numeric NULL,
          "idle_fuel_waste_litres" numeric NULL,
          "idle_fuel_waste_rand" numeric NULL,
          "flags" jsonb NOT NULL DEFAULT '[]'::jsonb,
          "computed_at" timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY ("day", "vehicle_id")
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."vehicle_day_reconciliation"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."vehicle_tracking_daily"`,
      );
    }
  }
}
