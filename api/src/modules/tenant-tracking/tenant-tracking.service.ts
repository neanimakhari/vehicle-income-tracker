import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { AuditService } from '../audit/audit.service';
import { CommercialService } from '../commercial/commercial.service';
import { TenantVehicle } from '../tenant-vehicles/tenant-vehicle.entity';
import { GpsTrackingPoint } from './gps-tracking-point.entity';
import { TrackerDevice } from './tracker-device.entity';
import { TrackingGateway } from './tracking.gateway';
import { GeofenceService } from './geofence.service';
import { TrackingEventsService } from './tracking-events.service';

export type InsertPointInput = {
  vehicleId?: string | null;
  vehicleLabel?: string | null;
  deviceId?: string | null;
  source?: string;
  latitude: number;
  longitude: number;
  speedKph?: number | null;
  heading?: number | null;
  ignitionOn?: boolean | null;
  externalVoltage?: number | null;
  backupBatteryLevel?: number | null;
  gpsFixOk?: boolean | null;
  satellites?: number | null;
  engineRpm?: number | null;
  fuelRateLph?: number | null;
  fuelLevelPercent?: number | null;
  odometerKm?: number | null;
  coolantC?: number | null;
  engineLoadPercent?: number | null;
  overspeed?: boolean | null;
  alarmFlags?: number | null;
  alarmExt?: string | null;
  gsmSignal?: number | null;
  msgId?: number | null;
  canOdometerKm?: number | null;
  canSpeedKph?: number | null;
  recordedAt?: Date;
  rawPayload?: string | null;
};

const MIN_POINT_INTERVAL_MS = 5_000;
const MAX_SIMULATE_POINTS = 120;

@Injectable()
export class TenantTrackingService {
  private readonly lastInsertAt = new Map<string, number>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly tenantScope: TenantScopeService,
    private readonly commercial: CommercialService,
    private readonly audit: AuditService,
    private readonly gateway: TrackingGateway,
    private readonly geofences: GeofenceService,
    private readonly trackingEvents: TrackingEventsService,
    @InjectRepository(TrackerDevice)
    private readonly devicesRepo: Repository<TrackerDevice>,
  ) {}

  private pointsRepo() {
    return new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      GpsTrackingPoint,
    );
  }

  private vehiclesRepo() {
    return new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantVehicle,
    );
  }

  private slug(): string {
    const slug = this.tenantContext.getTenantId();
    if (!slug) throw new BadRequestException('Tenant context missing');
    return slug;
  }

  private toDto(p: GpsTrackingPoint | Record<string, unknown>, includeObd: boolean) {
    const row = p as Record<string, unknown>;
    const pick = <T = unknown>(camel: string, snake: string): T | undefined =>
      (row[camel] !== undefined ? row[camel] : row[snake]) as T | undefined;

    const recordedRaw = pick<Date | string>('recordedAt', 'recorded_at');
    let recordedAt: string | null = null;
    if (recordedRaw instanceof Date) recordedAt = recordedRaw.toISOString();
    else if (recordedRaw != null && String(recordedRaw) !== 'undefined') {
      recordedAt = String(recordedRaw);
    }

    const lat = pick<number | string>('latitude', 'latitude');
    const lng = pick<number | string>('longitude', 'longitude');
    const speed = pick<number | string>('speedKph', 'speed_kph');
    const heading = pick<number | string>('heading', 'heading');

    const base: Record<string, unknown> = {
      id: pick('id', 'id'),
      vehicleId: pick('vehicleId', 'vehicle_id') ?? null,
      vehicleLabel: pick('vehicleLabel', 'vehicle_label') ?? null,
      deviceId: pick('deviceId', 'device_id') ?? null,
      source: pick('source', 'source') ?? null,
      latitude: lat != null ? Number(lat) : null,
      longitude: lng != null ? Number(lng) : null,
      speedKph: speed != null ? Number(speed) : null,
      heading: heading != null ? Number(heading) : null,
      ignitionOn: pick('ignitionOn', 'ignition_on') ?? null,
      gpsFixOk: pick('gpsFixOk', 'gps_fix_ok') ?? null,
      satellites: pick('satellites', 'satellites') ?? null,
      backupBatteryLevel:
        pick('backupBatteryLevel', 'backup_battery_level') ?? null,
      overspeed: pick('overspeed', 'overspeed') ?? null,
      recordedAt,
      gsmSignal: pick('gsmSignal', 'gsm_signal') ?? null,
      alarmFlags: pick('alarmFlags', 'alarm_flags') ?? null,
    };
    // Voltage is always useful (OBD-rail / battery) even without full OBD module
    {
      const externalVoltage = pick<number | string>(
        'externalVoltage',
        'external_voltage',
      );
      const odometerKm = pick<number | string>('odometerKm', 'odometer_km');
      base.externalVoltage =
        externalVoltage != null ? Number(externalVoltage) : null;
      base.odometerKm = odometerKm != null ? Number(odometerKm) : null;
    }
    if (includeObd) {
      const engineRpm = pick<number | string>('engineRpm', 'engine_rpm');
      const fuelRateLph = pick<number | string>('fuelRateLph', 'fuel_rate_lph');
      const fuelLevelPercent = pick<number | string>(
        'fuelLevelPercent',
        'fuel_level_percent',
      );
      const coolantC = pick<number | string>('coolantC', 'coolant_c');
      const engineLoadPercent = pick<number | string>(
        'engineLoadPercent',
        'engine_load_percent',
      );
      base.engineRpm = engineRpm != null ? Number(engineRpm) : null;
      base.fuelRateLph = fuelRateLph != null ? Number(fuelRateLph) : null;
      base.fuelLevelPercent =
        fuelLevelPercent != null ? Number(fuelLevelPercent) : null;
      base.coolantC = coolantC != null ? Number(coolantC) : null;
      base.engineLoadPercent =
        engineLoadPercent != null ? Number(engineLoadPercent) : null;
    }
    return base;
  }

  async recordLiveMapView(actor: {
    userId?: string | null;
    role?: string | null;
  }) {
    await this.audit.log({
      action: 'tracking.live_map_view',
      actorUserId: actor.userId ?? null,
      actorRole: actor.role ?? null,
      targetType: 'tracking',
      targetId: this.slug(),
      metadata: { at: new Date().toISOString() },
    });
  }

  async latest() {
    const slug = this.slug();
    const includeObd = await this.commercial.hasModule(slug, 'tracking_obd');
    const schema = this.tenantScope.getTenantSchema();
    const rows: GpsTrackingPoint[] = await this.dataSource.query(
      `SELECT DISTINCT ON (COALESCE("vehicle_id"::text, "vehicle_label", "id"::text)) *
       FROM "${schema}"."gps_tracking_points"
       ORDER BY COALESCE("vehicle_id"::text, "vehicle_label", "id"::text), "recorded_at" DESC
       LIMIT 200`,
    );
    return rows.map((r) => this.toDto(r, includeObd));
  }

  async history(opts: {
    limit?: number;
    vehicleId?: string;
    from?: string;
    to?: string;
  }) {
    const slug = this.slug();
    if (!(await this.commercial.hasModule(slug, 'tracking_history'))) {
      throw new ForbiddenException({
        message: 'Module not entitled: tracking_history',
        code: 'FEATURE_NOT_ENTITLED',
        moduleKey: 'tracking_history',
      });
    }
    const includeObd = await this.commercial.hasModule(slug, 'tracking_obd');
    const maxLimit = 2000;
    const limit = Math.min(maxLimit, Math.max(1, opts.limit ?? 100));
    const ranged = Boolean(opts.from || opts.to);

    const rows = await this.pointsRepo().withSchema(async (repo) => {
      const qb = repo.createQueryBuilder('p');
      if (opts.vehicleId) {
        qb.andWhere('p.vehicleId = :vid', { vid: opts.vehicleId });
      }
      if (opts.from) {
        qb.andWhere('p.recordedAt >= :from', { from: new Date(opts.from) });
      }
      if (opts.to) {
        qb.andWhere('p.recordedAt <= :to', { to: new Date(opts.to) });
      }
      if (ranged) {
        qb.orderBy('p.recordedAt', 'ASC').take(limit + 1);
      } else {
        // Live/recent: newest first, then reverse for chronological trail
        qb.orderBy('p.recordedAt', 'DESC').take(limit);
      }
      return qb.getMany();
    });

    let ordered = ranged ? rows : [...rows].reverse();

    if (ranged && ordered.length > limit) {
      const sampled: typeof ordered = [];
      const n = ordered.length;
      const step = (n - 1) / (limit - 1);
      for (let i = 0; i < limit; i++) {
        const idx = Math.min(n - 1, Math.round(i * step));
        if (
          sampled.length === 0 ||
          sampled[sampled.length - 1] !== ordered[idx]
        ) {
          sampled.push(ordered[idx]);
        }
      }
      if (sampled[sampled.length - 1] !== ordered[n - 1]) {
        sampled.push(ordered[n - 1]);
      }
      ordered = sampled;
    }

    return ordered.map((r) => this.toDto(r, includeObd));
  }

  async metricsSummary(opts: {
    from?: string;
    to?: string;
    vehicleId?: string;
  }) {
    const slug = this.slug();
    const includeObd = await this.commercial.hasModule(slug, 'tracking_obd');
    const schema = this.tenantScope.getTenantSchema();
    const from = opts.from
      ? new Date(opts.from)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = opts.to ? new Date(opts.to) : new Date();
    const params: unknown[] = [from, to];
    let vehicleFilter = '';
    if (opts.vehicleId) {
      params.push(opts.vehicleId);
      vehicleFilter = `AND "vehicle_id" = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT
         "vehicle_id" AS "vehicleId",
         MAX("vehicle_label") AS "vehicleLabel",
         COUNT(*)::int AS "pointCount",
         MAX("speed_kph") AS "maxSpeedKph",
         AVG("speed_kph") AS "avgSpeedKph",
         SUM(CASE WHEN COALESCE("speed_kph",0) > 3 THEN 1 ELSE 0 END)::int AS "movingSamples",
         SUM(CASE WHEN COALESCE("speed_kph",0) <= 3 THEN 1 ELSE 0 END)::int AS "idleSamples"
         ${includeObd ? `, AVG("fuel_rate_lph") AS "avgFuelRateLph", AVG("engine_rpm") AS "avgEngineRpm"` : ''}
       FROM "${schema}"."gps_tracking_points"
       WHERE "recorded_at" >= $1 AND "recorded_at" <= $2 ${vehicleFilter}
       GROUP BY "vehicle_id"`,
      params,
    );
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      includeObd,
      vehicles: rows,
    };
  }

  private assertRateLimit(key: string) {
    const now = Date.now();
    const prev = this.lastInsertAt.get(key) ?? 0;
    if (now - prev < MIN_POINT_INTERVAL_MS) {
      throw new BadRequestException({
        message: 'Point rate limit exceeded',
        code: 'TRACKING_RATE_LIMIT',
      });
    }
    this.lastInsertAt.set(key, now);
  }

  async insertPoint(
    input: InsertPointInput,
    opts?: { skipRateLimit?: boolean },
  ) {
    const slug = this.slug();
    if (!opts?.skipRateLimit) {
      this.assertRateLimit(
        `${slug}:${input.vehicleId ?? input.deviceId ?? 'unknown'}`,
      );
    }
    const recordedAt = input.recordedAt ?? new Date();
    const limitKph = await this.trackingEvents.getSpeedLimitKph();
    const overspeed =
      input.overspeed === true
        ? true
        : this.trackingEvents.computeOverspeed({
            speedKph: input.speedKph,
            alarmFlags: input.alarmFlags,
            limitKph,
          });

    const saved = await this.pointsRepo().withSchema(async (repo) => {
      const point = repo.create({
        vehicleId: input.vehicleId ?? null,
        vehicleLabel: input.vehicleLabel ?? null,
        deviceId: input.deviceId ?? null,
        source: input.source ?? 'api',
        latitude: input.latitude,
        longitude: input.longitude,
        speedKph: input.speedKph ?? null,
        heading: input.heading ?? null,
        ignitionOn: input.ignitionOn ?? null,
        externalVoltage: input.externalVoltage ?? null,
        backupBatteryLevel: input.backupBatteryLevel ?? null,
        gpsFixOk: input.gpsFixOk ?? null,
        satellites: input.satellites ?? null,
        engineRpm: input.engineRpm ?? null,
        fuelRateLph: input.fuelRateLph ?? null,
        fuelLevelPercent: input.fuelLevelPercent ?? null,
        odometerKm: input.odometerKm ?? null,
        coolantC: input.coolantC ?? null,
        engineLoadPercent: input.engineLoadPercent ?? null,
        overspeed,
        alarmFlags:
          input.alarmFlags != null ? String(input.alarmFlags) : null,
        alarmExt: input.alarmExt ?? null,
        gsmSignal: input.gsmSignal ?? null,
        msgId: input.msgId ?? null,
        canOdometerKm: input.canOdometerKm ?? null,
        canSpeedKph: input.canSpeedKph ?? null,
        recordedAt,
        rawPayload: input.rawPayload ?? null,
      });
      return repo.save(point);
    });

    // Always stamp device last_seen when we know the IMEI (Vehicles GPS column).
    const imei = input.deviceId?.trim();
    if (imei && input.source !== 'simulate') {
      try {
        const device = await this.devicesRepo.findOne({ where: { imei } });
        if (device) {
          device.lastSeenAt = recordedAt;
          if (input.vehicleId && !device.vehicleId) {
            device.vehicleId = input.vehicleId;
          }
          await this.devicesRepo.save(device);
        }
      } catch {
        /* device table optional for pure API inserts */
      }
    }

    try {
      const schema = this.tenantScope.getTenantSchema();
      await this.dataSource.query(
        `UPDATE "${schema}"."gps_tracking_points"
         SET "location" = ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326)::geography
         WHERE "id" = $3`,
        [input.longitude, input.latitude, saved.id],
      );
    } catch {
      /* postgis optional */
    }

    try {
      await this.trackingEvents.processPointEdges({
        vehicleId: saved.vehicleId,
        deviceId: saved.deviceId,
        pointId: saved.id,
        ignitionOn: saved.ignitionOn,
        overspeed: saved.overspeed === true,
        externalVoltage:
          saved.externalVoltage != null
            ? Number(saved.externalVoltage)
            : null,
        gpsFixOk: saved.gpsFixOk,
        alarmFlags: input.alarmFlags ?? null,
        alarmExt: input.alarmExt ?? null,
        latitude: Number(saved.latitude),
        longitude: Number(saved.longitude),
        speedKph:
          saved.speedKph != null ? Number(saved.speedKph) : null,
        recordedAt: saved.recordedAt,
        source: saved.source,
      });
    } catch {
      /* events must not break ingest */
    }

    const includeObd = await this.commercial.hasModule(slug, 'tracking_obd');
    const dto = this.toDto(saved, includeObd);
    this.gateway.emitPoint(slug, dto);

    if (saved.vehicleId) {
      try {
        await this.geofences.evaluatePoint({
          vehicleId: saved.vehicleId,
          pointId: saved.id,
          latitude: Number(saved.latitude),
          longitude: Number(saved.longitude),
          speedKph: saved.speedKph != null ? Number(saved.speedKph) : null,
          recordedAt: saved.recordedAt,
          source: saved.source,
        });
      } catch {
        /* geofence eval must not break ingest */
      }
    }

    return dto;
  }

  async simulate(opts: {
    vehicleId: string;
    profile: 'basic' | 'obd';
    points?: number;
  }) {
    const slug = this.slug();
    if (opts.profile === 'obd') {
      if (!(await this.commercial.hasModule(slug, 'tracking_obd'))) {
        throw new ForbiddenException({
          message: 'Module not entitled: tracking_obd',
          code: 'FEATURE_NOT_ENTITLED',
          moduleKey: 'tracking_obd',
        });
      }
    }
    const vehicle = await this.vehiclesRepo().withSchema((repo) =>
      repo.findOne({ where: { id: opts.vehicleId } }),
    );
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const count = Math.min(
      MAX_SIMULATE_POINTS,
      Math.max(1, opts.points ?? 24),
    );
    const intervalMs = MIN_POINT_INTERVAL_MS;
    let lat = -26.2041 + (Math.random() - 0.5) * 0.02;
    let lng = 28.0473 + (Math.random() - 0.5) * 0.02;
    let fuel = 70 + Math.random() * 20;
    const created: Record<string, unknown>[] = [];
    const start = Date.now() - count * intervalMs;

    for (let i = 0; i < count; i++) {
      const heading = (i * 25) % 360;
      const speed = 25 + Math.random() * 55;
      const rad = (heading * Math.PI) / 180;
      lat += Math.cos(rad) * 0.00028;
      lng += Math.sin(rad) * 0.00028;
      fuel = Math.max(8, fuel - 0.12 - Math.random() * 0.08);
      // Keep the demo "live" — last point stays moving with full telemetry
      const ignitionOn = true;
      const input: InsertPointInput = {
        vehicleId: vehicle.id,
        vehicleLabel: vehicle.label,
        deviceId: vehicle.trackerImei ?? `sim-${vehicle.id.slice(0, 8)}`,
        source: 'simulate',
        latitude: lat,
        longitude: lng,
        speedKph: speed,
        heading,
        ignitionOn,
        gpsFixOk: true,
        satellites: 10 + Math.floor(Math.random() * 6),
        recordedAt: new Date(start + i * intervalMs),
        rawPayload: JSON.stringify({ profile: opts.profile, i }),
      };
      // Full GPS quality fields always; OBD block when profile=obd
      input.backupBatteryLevel = 70 + Math.floor(Math.random() * 25);
      if (opts.profile === 'obd') {
        input.engineRpm = 1400 + Math.random() * 2200;
        input.fuelRateLph = 2.5 + Math.random() * 7;
        input.fuelLevelPercent = fuel;
        input.externalVoltage = 13.1 + Math.random() * 1.1;
        input.odometerKm = 52000 + i * 0.08 + Math.random() * 0.02;
        input.coolantC = 82 + Math.random() * 14;
        input.engineLoadPercent = 18 + Math.random() * 55;
        input.overspeed = speed > 60;
      }
      created.push(await this.insertPoint(input, { skipRateLimit: true }));
    }
    return { created: created.length, points: created.slice(-5) };
  }

  async bindImei(vehicleId: string, imei: string) {
    const slug = this.slug();
    const cleaned = imei.trim();
    if (!cleaned || cleaned.length < 8) {
      throw new BadRequestException('Invalid IMEI');
    }
    const vehicle = await this.vehiclesRepo().withSchema((repo) =>
      repo.findOne({ where: { id: vehicleId } }),
    );
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const existing = await this.devicesRepo.findOne({
      where: { imei: cleaned },
    });
    if (existing && existing.tenantSlug !== slug) {
      throw new BadRequestException('IMEI already bound to another tenant');
    }

    await this.vehiclesRepo().withSchema(async (repo) => {
      vehicle.trackerImei = cleaned;
      await repo.save(vehicle);
    });

    if (existing) {
      existing.vehicleId = vehicleId;
      existing.tenantSlug = slug;
      existing.isActive = true;
      await this.devicesRepo.save(existing);
    } else {
      await this.devicesRepo.save(
        this.devicesRepo.create({
          imei: cleaned,
          tenantSlug: slug,
          vehicleId,
          isActive: true,
        }),
      );
    }
    return { vehicleId, imei: cleaned, isActive: true };
  }

  async unbindImei(vehicleId: string) {
    const slug = this.slug();
    const vehicle = await this.vehiclesRepo().withSchema((repo) =>
      repo.findOne({ where: { id: vehicleId } }),
    );
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const imei = vehicle.trackerImei;
    await this.vehiclesRepo().withSchema(async (repo) => {
      vehicle.trackerImei = null;
      await repo.save(vehicle);
    });
    if (imei) {
      const device = await this.devicesRepo.findOne({ where: { imei } });
      if (device && device.tenantSlug === slug) {
        await this.devicesRepo.remove(device);
      }
    }
    return { vehicleId, unbound: true };
  }

  async setDeviceActive(imei: string, isActive: boolean) {
    const slug = this.slug();
    const device = await this.devicesRepo.findOne({ where: { imei } });
    if (!device || device.tenantSlug !== slug) {
      throw new NotFoundException('Device not found');
    }
    device.isActive = isActive;
    await this.devicesRepo.save(device);
    return { imei, isActive };
  }

  /** Heartbeat / register — update lastSeen without inserting a point. */
  async touchDeviceSeen(imei: string) {
    const device = await this.devicesRepo.findOne({ where: { imei } });
    if (!device || !device.isActive) {
      throw new ForbiddenException({
        message: 'Unknown or inactive IMEI',
        code: 'TRACKER_REJECTED',
      });
    }
    device.lastSeenAt = new Date();
    await this.devicesRepo.save(device);
    return { imei, lastSeenAt: device.lastSeenAt };
  }

  /**
   * Send JT808 / Micodus command via gps-ingest session bridge.
   */
  async sendDeviceCommand(
    imei: string,
    body: Record<string, unknown>,
    actor?: { sub?: string; role?: string },
  ) {
    const slug = this.slug();
    const device = await this.devicesRepo.findOne({ where: { imei } });
    if (!device || device.tenantSlug !== slug) {
      throw new NotFoundException('Device not found');
    }

    const base =
      process.env.GPS_INGEST_COMMAND_URL ??
      process.env.GPS_INGEST_URL ??
      'http://gps-ingest:9088';
    const secret =
      process.env.GPS_INGEST_SECRET ?? process.env.TRACKING_INGEST_SECRET ?? '';
    if (!secret) {
      throw new BadRequestException('GPS_INGEST_SECRET not configured');
    }

    const url = `${base.replace(/\/$/, '')}/internal/command`;
    const payload = { ...body, imei };
    let result: Record<string, unknown>;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ingest-secret': secret,
        },
        body: JSON.stringify(payload),
      });
      result = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new BadRequestException(
          (result.error as string) ?? `Command failed (${res.status})`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `gps-ingest unreachable: ${String((err as Error).message ?? err)}`,
      );
    }

    await this.audit.log({
      action: 'TRACKING_DEVICE_COMMAND',
      actorUserId: actor?.sub ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'tracker_device',
      targetId: imei,
      metadata: {
        tenant: slug,
        vehicleId: device.vehicleId,
        command: body,
        result,
      },
    });

    return { imei, vehicleId: device.vehicleId, ...result };
  }

  async listDevices() {
    return this.devicesRepo.find({
      where: { tenantSlug: this.slug() },
      order: { updatedAt: 'DESC' },
    });
  }

  /** Used by gps-ingest — no HTTP tenant middleware. */
  async ingestByImei(
    imei: string,
    input: Omit<InsertPointInput, 'vehicleId' | 'deviceId'>,
  ) {
    const device = await this.devicesRepo.findOne({ where: { imei } });
    if (!device || !device.isActive) {
      throw new ForbiddenException({
        message: 'Unknown or inactive IMEI',
        code: 'TRACKER_REJECTED',
      });
    }
    if (
      !(await this.commercial.hasModule(device.tenantSlug, 'tracking_live'))
    ) {
      throw new ForbiddenException({
        message: 'Tenant not entitled for tracking',
        code: 'FEATURE_NOT_ENTITLED',
      });
    }

    return this.tenantContext.runAsync(device.tenantSlug, async () => {
      const key = `${device.tenantSlug}:${device.vehicleId}`;
      this.assertRateLimit(key);

      const vehicle = await this.vehiclesRepo().withSchema((repo) =>
        repo.findOne({ where: { id: device.vehicleId } }),
      );
      const dto = await this.insertPoint(
        {
          ...input,
          vehicleId: device.vehicleId,
          vehicleLabel: vehicle?.label ?? null,
          deviceId: imei,
          source: input.source ?? 'obd',
        },
        { skipRateLimit: true },
      );
      device.lastSeenAt = new Date();
      await this.devicesRepo.save(device);
      return dto;
    });
  }
}
