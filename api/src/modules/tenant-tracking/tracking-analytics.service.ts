import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { CommercialService } from '../commercial/commercial.service';
import {
  computeDayRollup,
  johannesburgDayBounds,
  johannesburgToday,
  johannesburgYesterday,
  reconcileDay,
  TrackingSample,
} from './tracking-analytics.formulas';

@Injectable()
export class TrackingAnalyticsService {
  private readonly logger = new Logger(TrackingAnalyticsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly tenantScope: TenantScopeService,
    private readonly commercial: CommercialService,
  ) {}

  private schema(): string {
    return this.tenantScope.getTenantSchema();
  }

  private slug(): string {
    return this.tenantContext.getTenantId() ?? '';
  }

  async ensureRollupTables(schema?: string): Promise<void> {
    const s = schema ?? this.schema();
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."vehicle_tracking_daily" (
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
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS "idx_vehicle_tracking_daily_day"
      ON "${s}"."vehicle_tracking_daily" ("day" DESC)
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."vehicle_day_reconciliation" (
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

  private mapRow(row: Record<string, unknown>): TrackingSample {
    return {
      recordedAt: new Date(String(row.recorded_at)),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speedKph: row.speed_kph != null ? Number(row.speed_kph) : null,
      ignitionOn:
        row.ignition_on == null ? null : Boolean(row.ignition_on),
      odometerKm: row.odometer_km != null ? Number(row.odometer_km) : null,
      fuelRateLph:
        row.fuel_rate_lph != null ? Number(row.fuel_rate_lph) : null,
      fuelLevelPercent:
        row.fuel_level_percent != null
          ? Number(row.fuel_level_percent)
          : null,
      engineRpm: row.engine_rpm != null ? Number(row.engine_rpm) : null,
      engineLoadPercent:
        row.engine_load_percent != null
          ? Number(row.engine_load_percent)
          : null,
      coolantC: row.coolant_c != null ? Number(row.coolant_c) : null,
      externalVoltage:
        row.external_voltage != null ? Number(row.external_voltage) : null,
      backupBatteryLevel:
        row.backup_battery_level != null
          ? Number(row.backup_battery_level)
          : null,
      gpsFixOk: row.gps_fix_ok == null ? null : Boolean(row.gps_fix_ok),
      satellites: row.satellites != null ? Number(row.satellites) : null,
      overspeed: row.overspeed == null ? null : Boolean(row.overspeed),
      source: row.source != null ? String(row.source) : null,
    };
  }

  async recomputeVehicleDay(opts: {
    day: string;
    vehicleId: string;
    includeSimulate?: boolean;
  }) {
    await this.ensureRollupTables();
    const schema = this.schema();
    const { from, to } = johannesburgDayBounds(opts.day);
    const includeSimulate = opts.includeSimulate ?? false;

    const vehicles: Array<{ id: string; label: string }> =
      await this.dataSource.query(
        `SELECT "id", "label" FROM "${schema}"."vehicles" WHERE "id" = $1`,
        [opts.vehicleId],
      );
    if (!vehicles.length) return null;
    const vehicle = vehicles[0];

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT *
       FROM "${schema}"."gps_tracking_points"
       WHERE "vehicle_id" = $1
         AND "recorded_at" >= $2
         AND "recorded_at" <= $3
       ORDER BY "recorded_at" ASC`,
      [opts.vehicleId, from, to],
    );
    const samples = rows.map((r) => this.mapRow(r));
    const rollup = computeDayRollup(samples, { includeSimulate });

    await this.dataSource.query(
      `INSERT INTO "${schema}"."vehicle_tracking_daily" (
        "day", "vehicle_id", "vehicle_label", "point_count", "distance_km",
        "distance_basis", "moving_seconds", "idle_seconds", "ignition_on_seconds",
        "idle_pct", "utilisation_hours", "avg_speed_moving", "max_speed_kph",
        "stop_count", "estimated_litres", "litres_per_100km", "km_per_litre",
        "avg_fuel_rate_moving", "fuel_level_start", "fuel_level_end",
        "avg_rpm_moving", "avg_load_moving", "coolant_max", "coolant_hot_seconds",
        "high_rpm_low_speed_pct", "avg_external_voltage", "min_external_voltage",
        "low_voltage_pct", "avg_backup_battery", "gps_fix_ok_pct", "avg_satellites",
        "overspeed_sample_count", "overspeed_moving_pct", "obd_coverage_pct",
        "confidence", "include_simulate", "computed_at"
      ) VALUES (
        $1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34, $35, $36, now()
      )
      ON CONFLICT ("day", "vehicle_id") DO UPDATE SET
        "vehicle_label" = EXCLUDED."vehicle_label",
        "point_count" = EXCLUDED."point_count",
        "distance_km" = EXCLUDED."distance_km",
        "distance_basis" = EXCLUDED."distance_basis",
        "moving_seconds" = EXCLUDED."moving_seconds",
        "idle_seconds" = EXCLUDED."idle_seconds",
        "ignition_on_seconds" = EXCLUDED."ignition_on_seconds",
        "idle_pct" = EXCLUDED."idle_pct",
        "utilisation_hours" = EXCLUDED."utilisation_hours",
        "avg_speed_moving" = EXCLUDED."avg_speed_moving",
        "max_speed_kph" = EXCLUDED."max_speed_kph",
        "stop_count" = EXCLUDED."stop_count",
        "estimated_litres" = EXCLUDED."estimated_litres",
        "litres_per_100km" = EXCLUDED."litres_per_100km",
        "km_per_litre" = EXCLUDED."km_per_litre",
        "avg_fuel_rate_moving" = EXCLUDED."avg_fuel_rate_moving",
        "fuel_level_start" = EXCLUDED."fuel_level_start",
        "fuel_level_end" = EXCLUDED."fuel_level_end",
        "avg_rpm_moving" = EXCLUDED."avg_rpm_moving",
        "avg_load_moving" = EXCLUDED."avg_load_moving",
        "coolant_max" = EXCLUDED."coolant_max",
        "coolant_hot_seconds" = EXCLUDED."coolant_hot_seconds",
        "high_rpm_low_speed_pct" = EXCLUDED."high_rpm_low_speed_pct",
        "avg_external_voltage" = EXCLUDED."avg_external_voltage",
        "min_external_voltage" = EXCLUDED."min_external_voltage",
        "low_voltage_pct" = EXCLUDED."low_voltage_pct",
        "avg_backup_battery" = EXCLUDED."avg_backup_battery",
        "gps_fix_ok_pct" = EXCLUDED."gps_fix_ok_pct",
        "avg_satellites" = EXCLUDED."avg_satellites",
        "overspeed_sample_count" = EXCLUDED."overspeed_sample_count",
        "overspeed_moving_pct" = EXCLUDED."overspeed_moving_pct",
        "obd_coverage_pct" = EXCLUDED."obd_coverage_pct",
        "confidence" = EXCLUDED."confidence",
        "include_simulate" = EXCLUDED."include_simulate",
        "computed_at" = now()`,
      [
        opts.day,
        opts.vehicleId,
        vehicle.label,
        rollup.pointCount,
        rollup.distanceKm,
        rollup.distanceBasis,
        rollup.movingSeconds,
        rollup.idleSeconds,
        rollup.ignitionOnSeconds,
        rollup.idlePct,
        rollup.utilisationHours,
        rollup.avgSpeedMoving,
        rollup.maxSpeedKph,
        rollup.stopCount,
        rollup.estimatedLitres,
        rollup.litresPer100km,
        rollup.kmPerLitre,
        rollup.avgFuelRateMoving,
        rollup.fuelLevelStart,
        rollup.fuelLevelEnd,
        rollup.avgRpmMoving,
        rollup.avgLoadMoving,
        rollup.coolantMax,
        rollup.coolantHotSeconds,
        rollup.highRpmLowSpeedPct,
        rollup.avgExternalVoltage,
        rollup.minExternalVoltage,
        rollup.lowVoltagePct,
        rollup.avgBackupBattery,
        rollup.gpsFixOkPct,
        rollup.avgSatellites,
        rollup.overspeedSampleCount,
        rollup.overspeedMovingPct,
        rollup.obdCoveragePct,
        rollup.confidence,
        includeSimulate,
      ],
    );

    const incomeRows: Array<Record<string, string>> =
      await this.dataSource.query(
        `SELECT
           COALESCE(SUM(vi."income"), 0) AS income_total,
           COALESCE(SUM(vi."petrol_litres"), 0) AS petrol_litres,
           COALESCE(SUM(vi."petrol_poured"), 0) AS petrol_rand,
           COALESCE(SUM(CASE
             WHEN vi."end_km" IS NOT NULL AND vi."starting_km" IS NOT NULL
               AND vi."end_km" > vi."starting_km"
             THEN vi."end_km" - vi."starting_km" ELSE 0 END), 0) AS distance_km,
           COUNT(*)::int AS entry_count
         FROM "${schema}"."vehicle_incomes" vi
         WHERE vi."logged_on" >= $1 AND vi."logged_on" <= $2
           AND (
             vi."vehicle" = $3
             OR vi."vehicle" IN (
               SELECT "registration_number" FROM "${schema}"."vehicles" WHERE "id" = $4
             )
           )`,
        [from, to, vehicle.label, opts.vehicleId],
      );
    const income = {
      incomeTotal: Number(incomeRows[0]?.income_total ?? 0),
      petrolLitres: Number(incomeRows[0]?.petrol_litres ?? 0),
      petrolRand: Number(incomeRows[0]?.petrol_rand ?? 0),
      distanceKm: Number(incomeRows[0]?.distance_km ?? 0),
      entryCount: Number(incomeRows[0]?.entry_count ?? 0),
    };
    const rec = reconcileDay(rollup, income);

    await this.dataSource.query(
      `INSERT INTO "${schema}"."vehicle_day_reconciliation" (
        "day", "vehicle_id", "vehicle_label",
        "income_total", "income_petrol_litres", "income_petrol_rand",
        "income_distance_km", "income_entry_count",
        "tracker_distance_km", "tracker_estimated_litres",
        "distance_gap_pct", "fuel_gap_pct", "rand_per_tracker_km",
        "income_per_km", "income_per_ignition_hour",
        "idle_fuel_waste_litres", "idle_fuel_waste_rand",
        "flags", "computed_at"
      ) VALUES (
        $1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18::jsonb, now()
      )
      ON CONFLICT ("day", "vehicle_id") DO UPDATE SET
        "vehicle_label" = EXCLUDED."vehicle_label",
        "income_total" = EXCLUDED."income_total",
        "income_petrol_litres" = EXCLUDED."income_petrol_litres",
        "income_petrol_rand" = EXCLUDED."income_petrol_rand",
        "income_distance_km" = EXCLUDED."income_distance_km",
        "income_entry_count" = EXCLUDED."income_entry_count",
        "tracker_distance_km" = EXCLUDED."tracker_distance_km",
        "tracker_estimated_litres" = EXCLUDED."tracker_estimated_litres",
        "distance_gap_pct" = EXCLUDED."distance_gap_pct",
        "fuel_gap_pct" = EXCLUDED."fuel_gap_pct",
        "rand_per_tracker_km" = EXCLUDED."rand_per_tracker_km",
        "income_per_km" = EXCLUDED."income_per_km",
        "income_per_ignition_hour" = EXCLUDED."income_per_ignition_hour",
        "idle_fuel_waste_litres" = EXCLUDED."idle_fuel_waste_litres",
        "idle_fuel_waste_rand" = EXCLUDED."idle_fuel_waste_rand",
        "flags" = EXCLUDED."flags",
        "computed_at" = now()`,
      [
        opts.day,
        opts.vehicleId,
        vehicle.label,
        rec.incomeTotal,
        rec.incomePetrolLitres,
        rec.incomePetrolRand,
        rec.incomeDistanceKm,
        rec.incomeEntryCount,
        rec.trackerDistanceKm,
        rec.trackerEstimatedLitres,
        rec.distanceGapPct,
        rec.fuelGapPct,
        rec.randPerTrackerKm,
        rec.incomePerKm,
        rec.incomePerIgnitionHour,
        rec.idleFuelWasteLitres,
        rec.idleFuelWasteRand,
        JSON.stringify(rec.flags),
      ],
    );

    return { day: opts.day, vehicleId: opts.vehicleId, rollup, reconcile: rec };
  }

  async recomputeDayForTenant(
    day: string,
    opts?: { includeSimulate?: boolean },
  ) {
    await this.ensureRollupTables();
    const schema = this.schema();
    const { from, to } = johannesburgDayBounds(day);
    const vehicleIds: Array<{ vehicle_id: string }> =
      await this.dataSource.query(
        `SELECT DISTINCT "vehicle_id"
         FROM "${schema}"."gps_tracking_points"
         WHERE "recorded_at" >= $1 AND "recorded_at" <= $2
           AND "vehicle_id" IS NOT NULL
         UNION
         SELECT v."id" AS vehicle_id
         FROM "${schema}"."vehicles" v
         WHERE EXISTS (
           SELECT 1 FROM "${schema}"."vehicle_incomes" vi
           WHERE vi."logged_on" >= $1 AND vi."logged_on" <= $2
             AND (vi."vehicle" = v."label" OR vi."vehicle" = v."registration_number")
         )`,
        [from, to],
      );
    let n = 0;
    for (const row of vehicleIds) {
      await this.recomputeVehicleDay({
        day,
        vehicleId: row.vehicle_id,
        includeSimulate: opts?.includeSimulate,
      });
      n += 1;
    }
    return { day, vehicles: n };
  }

  async listAnalytics(opts: {
    from?: string;
    to?: string;
    vehicleId?: string;
  }) {
    await this.ensureRollupTables();
    const schema = this.schema();
    const from = opts.from ?? johannesburgToday();
    const to = opts.to ?? from;
    const params: unknown[] = [from, to];
    let vehicleFilter = '';
    if (opts.vehicleId) {
      params.push(opts.vehicleId);
      vehicleFilter = `AND "vehicle_id" = $${params.length}`;
    }
    const slug = this.slug();
    const includeObd = slug
      ? await this.commercial.hasModule(slug, 'tracking_obd')
      : false;
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}"."vehicle_tracking_daily"
       WHERE "day" >= $1::date AND "day" <= $2::date ${vehicleFilter}
       ORDER BY "day" DESC, "vehicle_label" ASC`,
      params,
    );
    return {
      from,
      to,
      includeObd,
      vehicles: rows.map((r: Record<string, unknown>) =>
        this.toAnalyticsDto(r, includeObd),
      ),
    };
  }

  async listReconciliation(opts: {
    from?: string;
    to?: string;
    vehicleId?: string;
  }) {
    await this.ensureRollupTables();
    const schema = this.schema();
    const from = opts.from ?? johannesburgToday();
    const to = opts.to ?? from;
    const params: unknown[] = [from, to];
    let vehicleFilter = '';
    if (opts.vehicleId) {
      params.push(opts.vehicleId);
      vehicleFilter = `AND "vehicle_id" = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}"."vehicle_day_reconciliation"
       WHERE "day" >= $1::date AND "day" <= $2::date ${vehicleFilter}
       ORDER BY "day" DESC, "vehicle_label" ASC`,
      params,
    );
    return {
      from,
      to,
      vehicles: rows.map((r: Record<string, unknown>) => ({
        day: String(r.day).slice(0, 10),
        vehicleId: r.vehicle_id,
        vehicleLabel: r.vehicle_label,
        incomeTotal: num(r.income_total),
        incomePetrolLitres: num(r.income_petrol_litres),
        incomePetrolRand: num(r.income_petrol_rand),
        incomeDistanceKm: num(r.income_distance_km),
        incomeEntryCount: Number(r.income_entry_count ?? 0),
        trackerDistanceKm: num(r.tracker_distance_km),
        trackerEstimatedLitres: num(r.tracker_estimated_litres),
        distanceGapPct: num(r.distance_gap_pct),
        fuelGapPct: num(r.fuel_gap_pct),
        randPerTrackerKm: num(r.rand_per_tracker_km),
        incomePerKm: num(r.income_per_km),
        incomePerIgnitionHour: num(r.income_per_ignition_hour),
        idleFuelWasteLitres: num(r.idle_fuel_waste_litres),
        idleFuelWasteRand: num(r.idle_fuel_waste_rand),
        flags: parseFlags(r.flags),
        computedAt: r.computed_at,
      })),
    };
  }

  private toAnalyticsDto(r: Record<string, unknown>, includeObd: boolean) {
    const base: Record<string, unknown> = {
      day: String(r.day).slice(0, 10),
      vehicleId: r.vehicle_id,
      vehicleLabel: r.vehicle_label,
      pointCount: Number(r.point_count ?? 0),
      distanceKm: num(r.distance_km),
      distanceBasis: r.distance_basis,
      movingSeconds: Number(r.moving_seconds ?? 0),
      idleSeconds: Number(r.idle_seconds ?? 0),
      ignitionOnSeconds: Number(r.ignition_on_seconds ?? 0),
      idlePct: num(r.idle_pct),
      utilisationHours: num(r.utilisation_hours),
      avgSpeedMoving: num(r.avg_speed_moving),
      maxSpeedKph: num(r.max_speed_kph),
      stopCount: Number(r.stop_count ?? 0),
      overspeedSampleCount: Number(r.overspeed_sample_count ?? 0),
      overspeedMovingPct: num(r.overspeed_moving_pct),
      gpsFixOkPct: num(r.gps_fix_ok_pct),
      avgSatellites: num(r.avg_satellites),
      avgExternalVoltage: num(r.avg_external_voltage),
      minExternalVoltage: num(r.min_external_voltage),
      lowVoltagePct: num(r.low_voltage_pct),
      avgBackupBattery: num(r.avg_backup_battery),
      confidence: r.confidence,
      computedAt: r.computed_at,
    };
    if (includeObd) {
      base.estimatedLitres = num(r.estimated_litres);
      base.litresPer100km = num(r.litres_per_100km);
      base.kmPerLitre = num(r.km_per_litre);
      base.avgFuelRateMoving = num(r.avg_fuel_rate_moving);
      base.fuelLevelStart = num(r.fuel_level_start);
      base.fuelLevelEnd = num(r.fuel_level_end);
      base.avgRpmMoving = num(r.avg_rpm_moving);
      base.avgLoadMoving = num(r.avg_load_moving);
      base.coolantMax = num(r.coolant_max);
      base.coolantHotSeconds = Number(r.coolant_hot_seconds ?? 0);
      base.highRpmLowSpeedPct = num(r.high_rpm_low_speed_pct);
      base.obdCoveragePct = num(r.obd_coverage_pct);
    }
    return base;
  }

  /** Used by scheduler — runs without HTTP tenant middleware. */
  async runForAllTenants(which: 'today' | 'yesterday') {
    const day =
      which === 'today' ? johannesburgToday() : johannesburgYesterday();
    const tenants: Array<{ slug: string }> = await this.dataSource.query(
      `SELECT "slug" FROM "platform"."tenants" WHERE "is_active" = true`,
    );
    for (const t of tenants) {
      try {
        await this.tenantContext.runAsync(t.slug, async () => {
          const entitled = await this.commercial.hasModule(
            t.slug,
            'tracking_live',
          );
          if (!entitled) return;
          await this.ensureRollupTables();
          await this.recomputeDayForTenant(day);
        });
      } catch (e) {
        this.logger.warn(
          `Analytics rollup failed for ${t.slug} ${day}: ${(e as Error).message}`,
        );
      }
    }
    return { day, tenants: tenants.length };
  }
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFlags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
