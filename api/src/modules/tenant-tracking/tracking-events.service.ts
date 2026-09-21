import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { CommercialService } from '../commercial/commercial.service';
import { EmailService } from '../email/email.service';
import { TrackingGateway } from './tracking.gateway';

export type TrackingEventInput = {
  vehicleId?: string | null;
  deviceId?: string | null;
  pointId?: string | null;
  eventType: string;
  severity?: 'info' | 'warning' | 'critical';
  message?: string | null;
  payload?: Record<string, unknown>;
  latitude?: number | null;
  longitude?: number | null;
  speedKph?: number | null;
  recordedAt: Date;
  source?: string | null;
};

type VehicleEdgeState = {
  ignitionOn: boolean | null;
  overspeed: boolean;
  lowVoltage: boolean;
  gpsFixOk: boolean | null;
};

/**
 * Device + server-derived tracking events (engine, overspeed, power, alarms).
 * Fires geofence_alert_rules when trigger matches and module entitled.
 */
@Injectable()
export class TrackingEventsService {
  private readonly logger = new Logger(TrackingEventsService.name);
  private readonly edgeState = new Map<string, VehicleEdgeState>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly commercial: CommercialService,
    private readonly email: EmailService,
    private readonly gateway: TrackingGateway,
  ) {}

  private schema() {
    return this.tenantScope.getTenantSchema();
  }

  private slug() {
    return this.tenantScope.getTenantSlug();
  }

  async ensureTables() {
    const s = this.schema();
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."tracking_events" (
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
    await this.dataSource.query(`
      ALTER TABLE "${s}"."tenant_tracking_settings"
        ADD COLUMN IF NOT EXISTS "overspeed_kph" numeric NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS "low_voltage_threshold" numeric NOT NULL DEFAULT 11.5,
        ADD COLUMN IF NOT EXISTS "offline_minutes" int NOT NULL DEFAULT 15,
        ADD COLUMN IF NOT EXISTS "idle_alert_minutes" int NOT NULL DEFAULT 20
    `);
    await this.dataSource.query(`
      ALTER TABLE "${s}"."gps_tracking_points"
        ADD COLUMN IF NOT EXISTS "alarm_flags" bigint NULL,
        ADD COLUMN IF NOT EXISTS "alarm_ext" varchar NULL,
        ADD COLUMN IF NOT EXISTS "gsm_signal" smallint NULL,
        ADD COLUMN IF NOT EXISTS "msg_id" int NULL,
        ADD COLUMN IF NOT EXISTS "can_odometer_km" numeric NULL,
        ADD COLUMN IF NOT EXISTS "can_speed_kph" numeric NULL
    `);
  }

  async getSpeedLimitKph(): Promise<number> {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT "overspeed_kph", "low_voltage_threshold"
       FROM "${this.schema()}"."tenant_tracking_settings" WHERE "id" = 1`,
    );
    const n = Number(rows[0]?.overspeed_kph ?? 60);
    return Number.isFinite(n) && n > 0 ? n : 60;
  }

  async getLowVoltageThreshold(): Promise<number> {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT "low_voltage_threshold"
       FROM "${this.schema()}"."tenant_tracking_settings" WHERE "id" = 1`,
    );
    const n = Number(rows[0]?.low_voltage_threshold ?? 11.5);
    return Number.isFinite(n) ? n : 11.5;
  }

  /**
   * Compute overspeed from speed limit and/or JT808 alarm bits (1=overspeed, 13=warning).
   */
  computeOverspeed(opts: {
    speedKph?: number | null;
    alarmFlags?: number | null;
    limitKph: number;
  }): boolean {
    const flags = Number(opts.alarmFlags ?? 0);
    if ((flags & (1 << 1)) !== 0 || (flags & (1 << 13)) !== 0) return true;
    const speed = opts.speedKph != null ? Number(opts.speedKph) : null;
    if (speed != null && Number.isFinite(speed) && speed >= opts.limitKph) {
      return true;
    }
    return false;
  }

  async record(input: TrackingEventInput) {
    if (input.source === 'simulate') return null;
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `INSERT INTO "${this.schema()}"."tracking_events"
        ("vehicle_id","device_id","point_id","event_type","severity","message","payload",
         "latitude","longitude","speed_kph","recorded_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)
       RETURNING *`,
      [
        input.vehicleId ?? null,
        input.deviceId ?? null,
        input.pointId ?? null,
        input.eventType,
        input.severity ?? 'info',
        input.message ?? null,
        JSON.stringify(input.payload ?? {}),
        input.latitude ?? null,
        input.longitude ?? null,
        input.speedKph ?? null,
        input.recordedAt,
      ],
    );
    const row = rows[0];
    const dto = {
      id: row.id,
      vehicleId: row.vehicle_id,
      deviceId: row.device_id,
      pointId: row.point_id,
      eventType: row.event_type,
      severity: row.severity,
      message: row.message,
      payload: row.payload,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      speedKph: row.speed_kph != null ? Number(row.speed_kph) : null,
      recordedAt: row.recorded_at,
    };
    this.gateway.emitAlert(this.slug(), dto);
    await this.maybeFireRule(input.eventType, dto);
    return dto;
  }

  /**
   * Detect ACC / overspeed / voltage / GPS / device-alarm edges after a new point.
   */
  async processPointEdges(opts: {
    vehicleId?: string | null;
    deviceId?: string | null;
    pointId: string;
    ignitionOn?: boolean | null;
    overspeed: boolean;
    externalVoltage?: number | null;
    gpsFixOk?: boolean | null;
    alarmFlags?: number | null;
    alarmExt?: string | null;
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    recordedAt: Date;
    source?: string | null;
  }) {
    if (opts.source === 'simulate') return;
    const key = `${this.slug()}:${opts.vehicleId ?? opts.deviceId ?? 'unknown'}`;
    const prev = this.edgeState.get(key) ?? {
      ignitionOn: null,
      overspeed: false,
      lowVoltage: false,
      gpsFixOk: null,
    };

    const lowThreshold = await this.getLowVoltageThreshold();
    const voltage =
      opts.externalVoltage != null ? Number(opts.externalVoltage) : null;
    const lowVoltage =
      voltage != null && Number.isFinite(voltage) && voltage > 0
        ? voltage < lowThreshold
        : false;

    const base = {
      vehicleId: opts.vehicleId,
      deviceId: opts.deviceId,
      pointId: opts.pointId,
      latitude: opts.latitude,
      longitude: opts.longitude,
      speedKph: opts.speedKph,
      recordedAt: opts.recordedAt,
      source: opts.source,
    };

    if (
      prev.ignitionOn === false &&
      opts.ignitionOn === true
    ) {
      await this.record({
        ...base,
        eventType: 'engine_start',
        severity: 'info',
        message: 'Engine / ACC on',
      });
    }
    if (prev.ignitionOn === true && opts.ignitionOn === false) {
      await this.record({
        ...base,
        eventType: 'engine_stop',
        severity: 'info',
        message: 'Engine / ACC off',
      });
    }

    if (!prev.overspeed && opts.overspeed) {
      await this.record({
        ...base,
        eventType: 'overspeed',
        severity: 'warning',
        message: `Overspeed ${opts.speedKph != null ? Number(opts.speedKph).toFixed(0) : '?'} km/h`,
        payload: { speedKph: opts.speedKph, alarmFlags: opts.alarmFlags },
      });
    }

    if (!prev.lowVoltage && lowVoltage) {
      await this.record({
        ...base,
        eventType: 'low_voltage',
        severity: 'warning',
        message: `Low voltage ${voltage?.toFixed(1)} V`,
        payload: { voltage, threshold: lowThreshold },
      });
    }

    // Power loss: steep drop (was charging/healthy → near zero)
    if (
      voltage != null &&
      voltage < 4 &&
      prev.lowVoltage === false &&
      opts.ignitionOn !== false
    ) {
      await this.record({
        ...base,
        eventType: 'power_loss',
        severity: 'critical',
        message: 'Tracker power loss / disconnect suspected',
        payload: { voltage },
      });
    }

    if (prev.gpsFixOk === true && opts.gpsFixOk === false) {
      await this.record({
        ...base,
        eventType: 'gps_lost',
        severity: 'warning',
        message: 'GPS fix lost',
      });
    }
    if (prev.gpsFixOk === false && opts.gpsFixOk === true) {
      await this.record({
        ...base,
        eventType: 'gps_fix',
        severity: 'info',
        message: 'GPS fix acquired',
      });
    }

    const flags = Number(opts.alarmFlags ?? 0);
    if (flags !== 0) {
      const bits = this.decodeAlarmBits(flags);
      for (const bit of bits) {
        await this.record({
          ...base,
          eventType: `device_alarm_${bit.key}`,
          severity: bit.severity,
          message: bit.label,
          payload: { alarmFlags: flags, bit: bit.bit },
        });
      }
    }

    this.edgeState.set(key, {
      ignitionOn: opts.ignitionOn ?? null,
      overspeed: opts.overspeed,
      lowVoltage,
      gpsFixOk: opts.gpsFixOk ?? null,
    });
  }

  decodeAlarmBits(flags: number) {
    const map: Array<{
      bit: number;
      key: string;
      label: string;
      severity: 'info' | 'warning' | 'critical';
    }> = [
      { bit: 0, key: 'sos', label: 'SOS / emergency', severity: 'critical' },
      { bit: 1, key: 'overspeed', label: 'Device overspeed', severity: 'warning' },
      { bit: 2, key: 'fatigue', label: 'Fatigue driving', severity: 'warning' },
      { bit: 7, key: 'undervoltage', label: 'Main power undervoltage', severity: 'warning' },
      { bit: 8, key: 'power_off', label: 'Main power disconnect', severity: 'critical' },
      { bit: 13, key: 'overspeed_warn', label: 'Overspeed warning', severity: 'warning' },
      { bit: 15, key: 'vibration', label: 'Vibration alarm', severity: 'warning' },
      { bit: 19, key: 'parking_timeout', label: 'Parking timeout', severity: 'info' },
      { bit: 20, key: 'area', label: 'Area enter/exit (device)', severity: 'info' },
      { bit: 27, key: 'illegal_ignition', label: 'Illegal ignition', severity: 'critical' },
      { bit: 28, key: 'displacement', label: 'Illegal displacement', severity: 'warning' },
      { bit: 29, key: 'collision', label: 'Collision', severity: 'critical' },
    ];
    return map.filter((m) => (flags & (1 << m.bit)) !== 0);
  }

  private async maybeFireRule(
    eventType: string,
    dto: { vehicleId?: string | null; message?: string | null },
  ) {
    const slug = this.slug();
    if (!(await this.commercial.hasModule(slug, 'tracking_alerts'))) return;

    // Map event types onto alert rule triggers
    const triggerMap: Record<string, string> = {
      overspeed: 'overspeed',
      device_alarm_overspeed: 'overspeed',
      device_alarm_overspeed_warn: 'overspeed',
      engine_start: 'engine_start',
      engine_stop: 'engine_stop',
      power_loss: 'power_loss',
      device_alarm_power_off: 'power_loss',
      low_voltage: 'low_voltage',
      device_alarm_undervoltage: 'low_voltage',
    };
    const trigger = triggerMap[eventType];
    if (!trigger) return;

    const s = this.schema();
    const rules = await this.dataSource.query(
      `SELECT * FROM "${s}"."geofence_alert_rules"
       WHERE "is_active" = true AND "trigger" = $1`,
      [trigger],
    );
    for (const rule of rules) {
      const cooldown = Number(rule.cooldown_minutes ?? 15);
      if (dto.vehicleId) {
        const recent = await this.dataSource.query(
          `SELECT 1 FROM "${s}"."geofence_alert_fires"
           WHERE "rule_id" = $1 AND "vehicle_id" = $2
             AND "fired_at" > now() - ($3::text || ' minutes')::interval
           LIMIT 1`,
          [rule.id, dto.vehicleId, String(cooldown)],
        );
        if (recent.length) continue;
      }
      const message =
        dto.message ?? rule.name ?? trigger;
      await this.dataSource.query(
        `INSERT INTO "${s}"."geofence_alert_fires"
          ("rule_id","vehicle_id","geofence_id","message")
         VALUES ($1,$2,NULL,$3)`,
        [rule.id, dto.vehicleId ?? null, message],
      );
      const channels: string[] = Array.isArray(rule.channels)
        ? rule.channels
        : [];
      if (channels.includes('email')) {
        try {
          await this.email.sendOpsAlert({
            method: 'TRACKING_ALERT',
            status: 200,
            path: `/tenant/${slug}/tracking/alerts`,
            message: String(message),
          });
        } catch (err) {
          this.logger.warn(`Alert email failed: ${String(err)}`);
        }
      }
    }
  }

  async listRecent(limit = 50) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."tracking_events"
       ORDER BY "recorded_at" DESC LIMIT $1`,
      [Math.min(200, Math.max(1, limit))],
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      deviceId: r.device_id,
      pointId: r.point_id,
      eventType: r.event_type,
      severity: r.severity,
      message: r.message,
      payload: r.payload,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      speedKph: r.speed_kph != null ? Number(r.speed_kph) : null,
      recordedAt: r.recorded_at,
      createdAt: r.created_at,
    }));
  }
}
