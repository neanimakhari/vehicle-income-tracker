import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PostGIS + Timescale (best-effort), OBD columns on gps_tracking_points,
 * tracker_imei on vehicles, platform.tracker_devices, commercial parent_key + tracking submodules.
 */
export class AddGpsTrackingDepth1700000000039 implements MigrationInterface {
  name = 'AddGpsTrackingDepth1700000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensions — may fail if packages missing / non-superuser.
    // Use SAVEPOINTs so a failure does not abort the outer migration transaction.
    try {
      await queryRunner.query(`SAVEPOINT sp_0039_postgis`);
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
      await queryRunner.query(`RELEASE SAVEPOINT sp_0039_postgis`);
    } catch (e) {
      await queryRunner.query(`ROLLBACK TO SAVEPOINT sp_0039_postgis`);
      console.warn(
        '[0039] postgis extension unavailable — geography column skipped:',
        (e as Error).message,
      );
    }
    let hasTimescale = false;
    try {
      await queryRunner.query(`SAVEPOINT sp_0039_timescale`);
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`);
      await queryRunner.query(`RELEASE SAVEPOINT sp_0039_timescale`);
      hasTimescale = true;
    } catch (e) {
      await queryRunner.query(`ROLLBACK TO SAVEPOINT sp_0039_timescale`);
      console.warn(
        '[0039] timescaledb extension unavailable — using btree indexes only:',
        (e as Error).message,
      );
    }
    // Prefer detecting already-installed extensions (e.g. created by superuser earlier)
    try {
      const ext: Array<{ exists: boolean }> = await queryRunner.query(
        `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') AS exists`,
      );
      if (ext[0]?.exists) hasTimescale = true;
    } catch {
      /* ignore */
    }

    await queryRunner.query(
      `ALTER TABLE "platform"."feature_modules"
       ADD COLUMN IF NOT EXISTS "parent_key" varchar NULL`,
    );
    // FK after column exists (self-ref)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "platform"."feature_modules"
          ADD CONSTRAINT "fk_feature_modules_parent"
          FOREIGN KEY ("parent_key") REFERENCES "platform"."feature_modules"("key")
          ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(
      `UPDATE "platform"."feature_modules"
       SET "name" = 'Live tracking',
           "description" = 'GPS live map, device bind, and realtime positions (parent module)'
       WHERE "key" = 'tracking_live'`,
    );

    await queryRunner.query(
      `INSERT INTO "platform"."feature_modules" ("key", "name", "description", "sort_order", "parent_key")
       VALUES
         ('tracking_history', 'Tracking history', 'Breadcrumbs and time-range history playback', 21, 'tracking_live'),
         ('tracking_obd', 'OBD metrics', 'Fuel rate, RPM, voltage and OBD demo profile', 22, 'tracking_live'),
         ('tracking_geofence', 'Geofences', 'Geofence zones and enter/exit events', 23, 'tracking_live'),
         ('tracking_alerts', 'Tracking alerts', 'Overspeed and ignition-related alerts', 24, 'tracking_live')
       ON CONFLICT ("key") DO UPDATE SET
         "parent_key" = EXCLUDED."parent_key",
         "name" = EXCLUDED."name",
         "description" = EXCLUDED."description",
         "sort_order" = EXCLUDED."sort_order"`,
    );

    await queryRunner.query(
      `INSERT INTO "platform"."plan_modules" ("plan_id", "module_key")
       SELECT p.id, m.key
       FROM "platform"."plans" p
       CROSS JOIN "platform"."feature_modules" m
       WHERE p.code = 'pro'
         AND m.key IN (
           'tracking_live', 'tracking_history', 'tracking_obd',
           'tracking_geofence', 'tracking_alerts'
         )
       ON CONFLICT DO NOTHING`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."tracker_devices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "imei" varchar NOT NULL UNIQUE,
        "tenant_slug" varchar NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_seen_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tracker_devices_tenant"
       ON "platform"."tracker_devices" ("tenant_slug")`,
    );

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

      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicles"
         ADD COLUMN IF NOT EXISTS "tracker_imei" varchar NULL`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "uq_vehicles_tracker_imei"
         ON "${schema}"."vehicles" ("tracker_imei")
         WHERE "tracker_imei" IS NOT NULL`,
      );

      const obdCols = [
        `ADD COLUMN IF NOT EXISTS "ignition_on" boolean NULL`,
        `ADD COLUMN IF NOT EXISTS "external_voltage" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "backup_battery_level" smallint NULL`,
        `ADD COLUMN IF NOT EXISTS "gps_fix_ok" boolean NULL`,
        `ADD COLUMN IF NOT EXISTS "satellites" smallint NULL`,
        `ADD COLUMN IF NOT EXISTS "engine_rpm" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "fuel_rate_lph" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "fuel_level_percent" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "odometer_km" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "coolant_c" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "engine_load_percent" numeric NULL`,
        `ADD COLUMN IF NOT EXISTS "overspeed" boolean NULL`,
      ];
      for (const col of obdCols) {
        await queryRunner.query(
          `ALTER TABLE "${schema}"."gps_tracking_points" ${col}`,
        );
      }

      if (hasPostgis) {
        try {
          await queryRunner.query(`SAVEPOINT sp_0039_geo_${tenant.slug.replace(/[^a-z0-9]/gi, '_')}`);
          await queryRunner.query(`
            DO $$ BEGIN
              ALTER TABLE "${schema}"."gps_tracking_points"
                ADD COLUMN IF NOT EXISTS "location" geography(Point,4326);
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
          `);
          await queryRunner.query(`
            UPDATE "${schema}"."gps_tracking_points"
            SET "location" = ST_SetSRID(
              ST_MakePoint("longitude"::float8, "latitude"::float8), 4326
            )::geography
            WHERE "location" IS NULL
          `);
          await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "idx_gps_points_location"
             ON "${schema}"."gps_tracking_points" USING GIST ("location")`,
          );
          await queryRunner.query(
            `RELEASE SAVEPOINT sp_0039_geo_${tenant.slug.replace(/[^a-z0-9]/gi, '_')}`,
          );
        } catch (e) {
          await queryRunner.query(
            `ROLLBACK TO SAVEPOINT sp_0039_geo_${tenant.slug.replace(/[^a-z0-9]/gi, '_')}`,
          );
          console.warn(
            `[0039] geography skip for ${schema}:`,
            (e as Error).message,
          );
        }
      }

      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_gps_points_vehicle_time"
         ON "${schema}"."gps_tracking_points" ("vehicle_id", "recorded_at" DESC)`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_gps_points_recorded"
         ON "${schema}"."gps_tracking_points" ("recorded_at" DESC)`,
      );

      if (hasTimescale) {
        const sp = `sp_0039_ht_${tenant.slug.replace(/[^a-z0-9]/gi, '_')}`;
        try {
          await queryRunner.query(`SAVEPOINT ${sp}`);
          // Timescale requires partition column in unique constraint
          await queryRunner.query(`
            DO $$ BEGIN
              ALTER TABLE "${schema}"."gps_tracking_points" DROP CONSTRAINT IF EXISTS "gps_tracking_points_pkey";
              ALTER TABLE "${schema}"."gps_tracking_points"
                ADD PRIMARY KEY ("id", "recorded_at");
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
          `);
          await queryRunner.query(
            `SELECT create_hypertable(
              '"${schema}"."gps_tracking_points"',
              'recorded_at',
              if_not_exists => TRUE,
              migrate_data => TRUE
            )`,
          );
          try {
            await queryRunner.query(`SAVEPOINT ${sp}_c`);
            await queryRunner.query(
              `SELECT add_compression_policy('"${schema}"."gps_tracking_points"', INTERVAL '7 days', if_not_exists => TRUE)`,
            );
            await queryRunner.query(`RELEASE SAVEPOINT ${sp}_c`);
          } catch {
            await queryRunner.query(`ROLLBACK TO SAVEPOINT ${sp}_c`);
          }
          try {
            await queryRunner.query(`SAVEPOINT ${sp}_r`);
            await queryRunner.query(
              `SELECT add_retention_policy('"${schema}"."gps_tracking_points"', INTERVAL '90 days', if_not_exists => TRUE)`,
            );
            await queryRunner.query(`RELEASE SAVEPOINT ${sp}_r`);
          } catch {
            await queryRunner.query(`ROLLBACK TO SAVEPOINT ${sp}_r`);
          }
          await queryRunner.query(`RELEASE SAVEPOINT ${sp}`);
        } catch (e) {
          await queryRunner.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          console.warn(
            `[0039] hypertable skip for ${schema}:`,
            (e as Error).message,
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "platform"."plan_modules" WHERE "module_key" IN (
        'tracking_history','tracking_obd','tracking_geofence','tracking_alerts'
      )`,
    );
    await queryRunner.query(
      `DELETE FROM "platform"."feature_modules" WHERE "key" IN (
        'tracking_history','tracking_obd','tracking_geofence','tracking_alerts'
      )`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."tracker_devices"`);
    await queryRunner.query(
      `ALTER TABLE "platform"."feature_modules" DROP COLUMN IF EXISTS "parent_key"`,
    );
  }
}
