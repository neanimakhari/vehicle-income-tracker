import { MigrationInterface, QueryRunner } from 'typeorm';

const DDL = (schema: string) => `
CREATE TABLE IF NOT EXISTS "${schema}"."geofences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "type" varchar NOT NULL,
  "geojson" jsonb NOT NULL,
  "center_lat" numeric NULL,
  "center_lng" numeric NULL,
  "radius_m" numeric NULL,
  "buffer_m" numeric NULL DEFAULT 200,
  "color" varchar NULL DEFAULT '#0d9488',
  "is_active" boolean NOT NULL DEFAULT true,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_geofences_type" ON "${schema}"."geofences" ("type");

CREATE TABLE IF NOT EXISTS "${schema}"."route_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "description" text NULL,
  "geofence_id" uuid NOT NULL REFERENCES "${schema}"."geofences"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "${schema}"."vehicle_geofences" (
  "vehicle_id" uuid NOT NULL,
  "geofence_id" uuid NOT NULL REFERENCES "${schema}"."geofences"("id") ON DELETE CASCADE,
  "role" varchar NOT NULL DEFAULT 'watch',
  "is_required_corridor" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("vehicle_id", "geofence_id")
);
CREATE INDEX IF NOT EXISTS "idx_vehicle_geofences_geofence"
  ON "${schema}"."vehicle_geofences" ("geofence_id");

CREATE TABLE IF NOT EXISTS "${schema}"."geofence_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicle_id" uuid NOT NULL,
  "geofence_id" uuid NOT NULL,
  "point_id" uuid NULL,
  "event_type" varchar NOT NULL,
  "latitude" numeric NOT NULL,
  "longitude" numeric NOT NULL,
  "speed_kph" numeric NULL,
  "source" varchar NULL,
  "recorded_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_geofence_events_vehicle_time"
  ON "${schema}"."geofence_events" ("vehicle_id", "recorded_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_geofence_events_fence_time"
  ON "${schema}"."geofence_events" ("geofence_id", "recorded_at" DESC);

CREATE TABLE IF NOT EXISTS "${schema}"."vehicle_geofence_state" (
  "vehicle_id" uuid NOT NULL,
  "geofence_id" uuid NOT NULL,
  "is_inside" boolean NOT NULL DEFAULT false,
  "entered_at" timestamptz NULL,
  "pending_inside" boolean NULL,
  "pending_count" int NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("vehicle_id", "geofence_id")
);

CREATE TABLE IF NOT EXISTS "${schema}"."vehicle_geofence_daily" (
  "day" date NOT NULL,
  "vehicle_id" uuid NOT NULL,
  "vehicle_label" varchar NULL,
  "point_count" int NOT NULL DEFAULT 0,
  "rank_dwell_seconds" int NOT NULL DEFAULT 0,
  "depot_dwell_seconds" int NOT NULL DEFAULT 0,
  "corridor_seconds" int NOT NULL DEFAULT 0,
  "off_corridor_seconds" int NOT NULL DEFAULT 0,
  "off_corridor_km" numeric NULL,
  "forbidden_seconds" int NOT NULL DEFAULT 0,
  "after_hours_outside_home_km" numeric NULL,
  "enter_count" int NOT NULL DEFAULT 0,
  "exit_count" int NOT NULL DEFAULT 0,
  "longest_rank_dwell_seconds" int NOT NULL DEFAULT 0,
  "off_corridor_pct" numeric NULL,
  "computed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("day", "vehicle_id")
);

CREATE TABLE IF NOT EXISTS "${schema}"."geofence_alert_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar NOT NULL,
  "trigger" varchar NOT NULL,
  "threshold_minutes" int NOT NULL DEFAULT 5,
  "channels" jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "cooldown_minutes" int NOT NULL DEFAULT 30,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "${schema}"."geofence_alert_fires" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_id" uuid NOT NULL REFERENCES "${schema}"."geofence_alert_rules"("id") ON DELETE CASCADE,
  "vehicle_id" uuid NOT NULL,
  "geofence_id" uuid NULL,
  "message" text NOT NULL,
  "fired_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_geofence_alert_fires_time"
  ON "${schema}"."geofence_alert_fires" ("fired_at" DESC);

CREATE TABLE IF NOT EXISTS "${schema}"."tenant_tracking_settings" (
  "id" int PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
  "work_window_start" time NOT NULL DEFAULT '04:00',
  "work_window_end" time NOT NULL DEFAULT '22:00',
  "default_corridor_buffer_m" int NOT NULL DEFAULT 200,
  "geofence_hysteresis_samples" int NOT NULL DEFAULT 2,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO "${schema}"."tenant_tracking_settings" ("id")
VALUES (1) ON CONFLICT DO NOTHING;
`;

const POSTGIS = (schema: string) => `
DO $$ BEGIN
  ALTER TABLE "${schema}"."geofences"
    ADD COLUMN IF NOT EXISTS "geom" geography(Polygon,4326);
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "idx_geofences_geom"
  ON "${schema}"."geofences" USING GIST ("geom");
`;

export class AddTrackingGeofences1700000000041 implements MigrationInterface {
  name = 'AddTrackingGeofences1700000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    let hasPostgis = false;
    try {
      const ext: Array<{ exists: boolean }> = await queryRunner.query(
        `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS exists`,
      );
      hasPostgis = Boolean(ext[0]?.exists);
    } catch {
      hasPostgis = false;
    }

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(DDL(schema));
      if (hasPostgis) {
        try {
          await queryRunner.query(`SAVEPOINT sp_0041_geo_${schema}`);
          await queryRunner.query(POSTGIS(schema));
          await queryRunner.query(`RELEASE SAVEPOINT sp_0041_geo_${schema}`);
        } catch (e) {
          await queryRunner.query(`ROLLBACK TO SAVEPOINT sp_0041_geo_${schema}`);
          console.warn(`[0041] postgis geom skip ${schema}:`, (e as Error).message);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      for (const t of [
        'geofence_alert_fires',
        'geofence_alert_rules',
        'vehicle_geofence_daily',
        'vehicle_geofence_state',
        'geofence_events',
        'vehicle_geofences',
        'route_templates',
        'geofences',
        'tenant_tracking_settings',
      ]) {
        await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."${t}" CASCADE`);
      }
    }
  }
}
