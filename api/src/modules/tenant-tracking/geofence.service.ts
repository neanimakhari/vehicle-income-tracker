import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { CommercialService } from '../commercial/commercial.service';
import { AuditService } from '../audit/audit.service';
import {
  FenceGeoJson,
  LatLng,
  normalizeGeoJsonForStorage,
  pointInFence,
  shiftGeoJson,
} from './geofence.geometry';
import {
  johannesburgDayBounds,
  johannesburgToday,
  johannesburgYesterday,
} from './tracking-analytics.formulas';
import { TrackingGateway } from './tracking.gateway';
import { TrackingEventsService } from './tracking-events.service';

export type GeofenceRow = {
  id: string;
  name: string;
  type: string;
  geojson: FenceGeoJson;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  buffer_m: number | null;
  color: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);
  private readonly assignCache = new Map<
    string,
    { at: number; rows: Array<GeofenceRow & { role: string; is_required_corridor: boolean }> }
  >();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly tenantScope: TenantScopeService,
    private readonly commercial: CommercialService,
    private readonly audit: AuditService,
    private readonly gateway: TrackingGateway,
    private readonly trackingEvents: TrackingEventsService,
  ) {}

  private schema() {
    return this.tenantScope.getTenantSchema();
  }

  private slug() {
    return this.tenantContext.getTenantId() ?? '';
  }

  async ensureTables(schema?: string) {
    const s = schema ?? this.schema();
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."geofences" (
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
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."route_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text NULL,
        "geofence_id" uuid NOT NULL REFERENCES "${s}"."geofences"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."fence_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text NULL,
        "kind" varchar NOT NULL DEFAULT 'polygon',
        "default_fence_type" varchar NOT NULL DEFAULT 'custom',
        "geojson" jsonb NOT NULL,
        "buffer_m" numeric NULL,
        "radius_m" numeric NULL,
        "color" varchar NULL DEFAULT '#0d9488',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."vehicle_geofences" (
        "vehicle_id" uuid NOT NULL,
        "geofence_id" uuid NOT NULL REFERENCES "${s}"."geofences"("id") ON DELETE CASCADE,
        "role" varchar NOT NULL DEFAULT 'watch',
        "is_required_corridor" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("vehicle_id", "geofence_id")
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."geofence_events" (
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
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."vehicle_geofence_state" (
        "vehicle_id" uuid NOT NULL,
        "geofence_id" uuid NOT NULL,
        "is_inside" boolean NOT NULL DEFAULT false,
        "entered_at" timestamptz NULL,
        "pending_inside" boolean NULL,
        "pending_count" int NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("vehicle_id", "geofence_id")
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."vehicle_geofence_daily" (
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
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."geofence_alert_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "trigger" varchar NOT NULL,
        "threshold_minutes" int NOT NULL DEFAULT 5,
        "channels" jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "cooldown_minutes" int NOT NULL DEFAULT 30,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."geofence_alert_fires" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "rule_id" uuid NOT NULL REFERENCES "${s}"."geofence_alert_rules"("id") ON DELETE CASCADE,
        "vehicle_id" uuid NOT NULL,
        "geofence_id" uuid NULL,
        "message" text NOT NULL,
        "fired_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS "${s}"."tenant_tracking_settings" (
        "id" int PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
        "work_window_start" time NOT NULL DEFAULT '04:00',
        "work_window_end" time NOT NULL DEFAULT '22:00',
        "default_corridor_buffer_m" int NOT NULL DEFAULT 200,
        "geofence_hysteresis_samples" int NOT NULL DEFAULT 2,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await this.dataSource.query(
      `INSERT INTO "${s}"."tenant_tracking_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING`,
    );
    await this.dataSource.query(`
      ALTER TABLE "${s}"."tenant_tracking_settings"
        ADD COLUMN IF NOT EXISTS "overspeed_kph" numeric NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS "low_voltage_threshold" numeric NOT NULL DEFAULT 11.5,
        ADD COLUMN IF NOT EXISTS "offline_minutes" int NOT NULL DEFAULT 15,
        ADD COLUMN IF NOT EXISTS "idle_alert_minutes" int NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS "quiet_hours_start" time NULL,
        ADD COLUMN IF NOT EXISTS "quiet_hours_end" time NULL
    `);
  }

  private invalidateCache() {
    this.assignCache.delete(this.slug());
  }

  async listGeofences() {
    await this.ensureTables();
    const rows: GeofenceRow[] = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."geofences" ORDER BY "name" ASC`,
    );
    return rows.map((r) => this.toFenceDto(r));
  }

  async getGeofence(id: string) {
    await this.ensureTables();
    const rows: GeofenceRow[] = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."geofences" WHERE "id" = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Geofence not found');
    return this.toFenceDto(rows[0]);
  }

  async createGeofence(body: {
    name: string;
    type: string;
    geojson?: FenceGeoJson;
    path?: LatLng[];
    centerLat?: number;
    centerLng?: number;
    radiusM?: number;
    bufferM?: number;
    color?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.ensureTables();
    const allowed = [
      'rank',
      'depot',
      'fuel',
      'forbidden',
      'custom',
      'corridor',
    ];
    if (!allowed.includes(body.type)) {
      throw new BadRequestException(`Invalid type: ${body.type}`);
    }
    const settings = await this.getSettings();
    const norm = normalizeGeoJsonForStorage({
      type: body.type,
      geojson: body.geojson,
      path: body.path,
      centerLat: body.centerLat,
      centerLng: body.centerLng,
      radiusM: body.radiusM,
      bufferM: body.bufferM ?? settings.defaultCorridorBufferM,
    });
    const rows = await this.dataSource.query(
      `INSERT INTO "${this.schema()}"."geofences"
        ("name","type","geojson","center_lat","center_lng","radius_m","buffer_m","color","metadata")
       VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING *`,
      [
        body.name,
        body.type,
        JSON.stringify(norm.geojson),
        body.centerLat ?? norm.centerLat,
        body.centerLng ?? norm.centerLng,
        body.radiusM ?? null,
        body.bufferM ?? settings.defaultCorridorBufferM,
        body.color ?? '#0d9488',
        JSON.stringify(body.metadata ?? {}),
      ],
    );
    this.invalidateCache();
    await this.audit.log({
      action: 'tracking.geofence.create',
      actorUserId: null,
      actorRole: 'TENANT_ADMIN',
      targetType: 'geofence',
      targetId: rows[0].id,
      metadata: { name: body.name, type: body.type },
    });
    return this.toFenceDto(rows[0]);
  }

  async updateGeofence(
    id: string,
    body: Partial<{
      name: string;
      type: string;
      geojson: FenceGeoJson;
      path: LatLng[];
      centerLat: number;
      centerLng: number;
      radiusM: number;
      bufferM: number;
      color: string;
      isActive: boolean;
      metadata: Record<string, unknown>;
    }>,
  ) {
    await this.ensureTables();
    const existing = await this.getGeofence(id);
    const type = String(body.type ?? existing.type);
    let geojson = existing.geojson as FenceGeoJson;
    let centerLat = body.centerLat ?? existing.centerLat;
    let centerLng = body.centerLng ?? existing.centerLng;
    if (body.geojson || body.path || body.radiusM != null) {
      const norm = normalizeGeoJsonForStorage({
        type,
        geojson: (body.geojson as FenceGeoJson | undefined) ?? undefined,
        path: body.path,
        centerLat: body.centerLat ?? existing.centerLat,
        centerLng: body.centerLng ?? existing.centerLng,
        radiusM: body.radiusM ?? existing.radiusM,
        bufferM: body.bufferM ?? existing.bufferM,
      });
      geojson = norm.geojson;
      centerLat = body.centerLat ?? norm.centerLat;
      centerLng = body.centerLng ?? norm.centerLng;
    }
    const rows = await this.dataSource.query(
      `UPDATE "${this.schema()}"."geofences" SET
        "name" = COALESCE($2, "name"),
        "type" = COALESCE($3, "type"),
        "geojson" = $4::jsonb,
        "center_lat" = $5,
        "center_lng" = $6,
        "radius_m" = COALESCE($7, "radius_m"),
        "buffer_m" = COALESCE($8, "buffer_m"),
        "color" = COALESCE($9, "color"),
        "is_active" = COALESCE($10, "is_active"),
        "metadata" = COALESCE($11::jsonb, "metadata"),
        "updated_at" = now()
       WHERE "id" = $1 RETURNING *`,
      [
        id,
        body.name ?? null,
        body.type ?? null,
        JSON.stringify(geojson),
        centerLat,
        centerLng,
        body.radiusM ?? null,
        body.bufferM ?? null,
        body.color ?? null,
        body.isActive ?? null,
        body.metadata ? JSON.stringify(body.metadata) : null,
      ],
    );
    this.invalidateCache();
    await this.audit.log({
      action: 'tracking.geofence.update',
      actorUserId: null,
      actorRole: 'TENANT_ADMIN',
      targetType: 'geofence',
      targetId: id,
      metadata: {},
    });
    return this.toFenceDto(rows[0]);
  }

  async deleteGeofence(id: string) {
    await this.ensureTables();
    await this.dataSource.query(
      `DELETE FROM "${this.schema()}"."geofences" WHERE "id" = $1`,
      [id],
    );
    this.invalidateCache();
    await this.audit.log({
      action: 'tracking.geofence.delete',
      actorUserId: null,
      actorRole: 'TENANT_ADMIN',
      targetType: 'geofence',
      targetId: id,
      metadata: {},
    });
    return { deleted: true };
  }

  async setVehicleAssignments(
    vehicleId: string,
    assignments: Array<{
      geofenceId: string;
      role: string;
      isRequiredCorridor?: boolean;
    }>,
  ) {
    await this.ensureTables();
    const s = this.schema();
    await this.dataSource.query(
      `DELETE FROM "${s}"."vehicle_geofences" WHERE "vehicle_id" = $1`,
      [vehicleId],
    );
    for (const a of assignments) {
      await this.dataSource.query(
        `INSERT INTO "${s}"."vehicle_geofences"
          ("vehicle_id","geofence_id","role","is_required_corridor")
         VALUES ($1,$2,$3,$4)`,
        [
          vehicleId,
          a.geofenceId,
          a.role,
          Boolean(a.isRequiredCorridor ?? a.role === 'corridor'),
        ],
      );
    }
    this.invalidateCache();
    await this.audit.log({
      action: 'tracking.geofence.assign',
      actorUserId: null,
      actorRole: 'TENANT_ADMIN',
      targetType: 'vehicle',
      targetId: vehicleId,
      metadata: { count: assignments.length },
    });
    return this.getVehicleAssignments(vehicleId);
  }

  async getVehicleAssignments(vehicleId: string) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT vg.*, g."name", g."type", g."color", g."geojson", g."buffer_m",
              g."center_lat", g."center_lng", g."radius_m"
       FROM "${this.schema()}"."vehicle_geofences" vg
       JOIN "${this.schema()}"."geofences" g ON g."id" = vg."geofence_id"
       WHERE vg."vehicle_id" = $1`,
      [vehicleId],
    );
    return rows.map((r: Record<string, unknown>) => ({
      vehicleId: r.vehicle_id,
      geofenceId: r.geofence_id,
      role: r.role,
      isRequiredCorridor: Boolean(r.is_required_corridor),
      name: r.name,
      type: r.type,
      color: r.color,
      geojson: r.geojson,
      bufferM: r.buffer_m != null ? Number(r.buffer_m) : null,
      centerLat: r.center_lat != null ? Number(r.center_lat) : null,
      centerLng: r.center_lng != null ? Number(r.center_lng) : null,
      radiusM: r.radius_m != null ? Number(r.radius_m) : null,
    }));
  }

  async createRouteTemplate(body: {
    name: string;
    description?: string;
    path: LatLng[];
    bufferM?: number;
    color?: string;
  }) {
    const fence = await this.createGeofence({
      name: body.name,
      type: 'corridor',
      path: body.path,
      bufferM: body.bufferM,
      color: body.color,
    });
    const rows = await this.dataSource.query(
      `INSERT INTO "${this.schema()}"."route_templates"
        ("name","description","geofence_id") VALUES ($1,$2,$3) RETURNING *`,
      [body.name, body.description ?? null, fence.id],
    );
    return { ...rows[0], geofence: fence };
  }

  async listRouteTemplates() {
    await this.ensureTables();
    return this.dataSource.query(
      `SELECT rt.*, g."geojson", g."buffer_m", g."color", g."type"
       FROM "${this.schema()}"."route_templates" rt
       JOIN "${this.schema()}"."geofences" g ON g."id" = rt."geofence_id"
       ORDER BY rt."name" ASC`,
    );
  }

  async listFenceTemplates() {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."fence_templates" ORDER BY "name" ASC`,
    );
    return rows.map((r: Record<string, unknown>) => this.mapFenceTemplate(r));
  }

  async createFenceTemplate(body: {
    name: string;
    description?: string;
    kind?: string;
    defaultFenceType?: string;
    geojson?: FenceGeoJson;
    path?: LatLng[];
    centerLat?: number;
    centerLng?: number;
    radiusM?: number;
    bufferM?: number;
    color?: string;
  }) {
    await this.ensureTables();
    const fenceType = body.defaultFenceType ?? (body.kind === 'corridor' ? 'corridor' : 'custom');
    const norm = normalizeGeoJsonForStorage({
      type: fenceType,
      geojson: body.geojson,
      path: body.path,
      centerLat: body.centerLat,
      centerLng: body.centerLng,
      radiusM: body.radiusM,
      bufferM: body.bufferM ?? 200,
    });
    const kind =
      body.kind ??
      (fenceType === 'corridor'
        ? 'corridor'
        : body.radiusM != null && !body.path
          ? 'circle'
          : 'polygon');
    const rows = await this.dataSource.query(
      `INSERT INTO "${this.schema()}"."fence_templates"
        ("name","description","kind","default_fence_type","geojson","buffer_m","radius_m","color")
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *`,
      [
        body.name,
        body.description ?? null,
        kind,
        fenceType,
        JSON.stringify(norm.geojson),
        body.bufferM ?? null,
        body.radiusM ?? null,
        body.color ?? '#0d9488',
      ],
    );
    return this.mapFenceTemplate(rows[0]);
  }

  async deleteFenceTemplate(id: string) {
    await this.ensureTables();
    await this.dataSource.query(
      `DELETE FROM "${this.schema()}"."fence_templates" WHERE "id" = $1`,
      [id],
    );
    return { deleted: true };
  }

  /** Clone a saved template into a live geofence (optionally offset). */
  async instantiateFenceTemplate(
    id: string,
    body: {
      name: string;
      type?: string;
      offsetLat?: number;
      offsetLng?: number;
      bufferM?: number;
      color?: string;
    },
  ) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."fence_templates" WHERE "id" = $1 LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Template not found');
    const tpl = rows[0] as Record<string, unknown>;
    let geojson = tpl.geojson as FenceGeoJson;
    if (typeof geojson === 'string') {
      try {
        geojson = JSON.parse(geojson) as FenceGeoJson;
      } catch {
        /* keep */
      }
    }
    const dLat = Number(body.offsetLat ?? 0);
    const dLng = Number(body.offsetLng ?? 0);
    if (dLat || dLng) {
      geojson = shiftGeoJson(geojson, dLat, dLng);
    }
    return this.createGeofence({
      name: body.name,
      type: body.type ?? String(tpl.default_fence_type ?? 'custom'),
      geojson,
      bufferM: body.bufferM ?? (tpl.buffer_m != null ? Number(tpl.buffer_m) : undefined),
      radiusM: tpl.radius_m != null ? Number(tpl.radius_m) : undefined,
      color: body.color ?? (tpl.color as string) ?? '#0d9488',
    });
  }

  private mapFenceTemplate(r: Record<string, unknown>) {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      kind: r.kind,
      defaultFenceType: r.default_fence_type,
      geojson: r.geojson,
      bufferM: r.buffer_m != null ? Number(r.buffer_m) : null,
      radiusM: r.radius_m != null ? Number(r.radius_m) : null,
      color: r.color,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async exportGeoJson() {
    const fences = await this.listGeofences();
    return {
      type: 'FeatureCollection',
      features: fences.map((f) => ({
        type: 'Feature',
        properties: {
          id: f.id,
          name: f.name,
          type: f.type,
          color: f.color,
          bufferM: f.bufferM,
          radiusM: f.radiusM,
        },
        geometry: f.geojson,
      })),
    };
  }

  async importGeoJson(fc: {
    type: string;
    features: Array<{
      type: string;
      properties?: Record<string, unknown>;
      geometry: FenceGeoJson;
    }>;
  }) {
    if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      throw new BadRequestException('Expected FeatureCollection');
    }
    const created: Array<ReturnType<GeofenceService['toFenceDto']>> = [];
    for (const feat of fc.features) {
      const props = feat.properties ?? {};
      const fence = await this.createGeofence({
        name: String(props.name ?? 'Imported zone'),
        type: String(props.type ?? 'custom'),
        geojson: feat.geometry,
        bufferM:
          props.bufferM != null ? Number(props.bufferM) : undefined,
        color: props.color != null ? String(props.color) : undefined,
        radiusM:
          props.radiusM != null ? Number(props.radiusM) : undefined,
        centerLat:
          props.centerLat != null ? Number(props.centerLat) : undefined,
        centerLng:
          props.centerLng != null ? Number(props.centerLng) : undefined,
      });
      created.push(fence);
    }
    return { created: created.length, fences: created };
  }

  async getSettings() {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."tenant_tracking_settings" WHERE "id" = 1`,
    );
    const r = rows[0] ?? {};
    const quietStart =
      r.quiet_hours_start != null
        ? String(r.quiet_hours_start).slice(0, 5)
        : null;
    const quietEnd =
      r.quiet_hours_end != null
        ? String(r.quiet_hours_end).slice(0, 5)
        : null;
    return {
      workWindowStart: String(r.work_window_start ?? '04:00').slice(0, 5),
      workWindowEnd: String(r.work_window_end ?? '22:00').slice(0, 5),
      defaultCorridorBufferM: Number(r.default_corridor_buffer_m ?? 200),
      geofenceHysteresisSamples: Number(
        r.geofence_hysteresis_samples ?? 2,
      ),
      overspeedKph: Number(r.overspeed_kph ?? 60),
      lowVoltageThreshold: Number(r.low_voltage_threshold ?? 11.5),
      offlineMinutes: Number(r.offline_minutes ?? 15),
      idleAlertMinutes: Number(r.idle_alert_minutes ?? 20),
      quietHoursStart: quietStart && quietStart !== 'null' ? quietStart : null,
      quietHoursEnd: quietEnd && quietEnd !== 'null' ? quietEnd : null,
    };
  }

  async updateSettings(body: {
    workWindowStart?: string;
    workWindowEnd?: string;
    defaultCorridorBufferM?: number;
    geofenceHysteresisSamples?: number;
    overspeedKph?: number;
    lowVoltageThreshold?: number;
    offlineMinutes?: number;
    idleAlertMinutes?: number;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  }) {
    await this.ensureTables();

    let quietStartParam: string | null = null;
    let quietEndParam: string | null = null;
    let touchQuiet = false;
    if (
      body.quietHoursStart !== undefined ||
      body.quietHoursEnd !== undefined
    ) {
      touchQuiet = true;
      const qs =
        body.quietHoursStart == null || body.quietHoursStart === ''
          ? null
          : String(body.quietHoursStart).slice(0, 5);
      const qe =
        body.quietHoursEnd == null || body.quietHoursEnd === ''
          ? null
          : String(body.quietHoursEnd).slice(0, 5);
      if (!qs || !qe) {
        quietStartParam = null;
        quietEndParam = null;
      } else {
        quietStartParam = qs;
        quietEndParam = qe;
      }
    }

    await this.dataSource.query(
      `UPDATE "${this.schema()}"."tenant_tracking_settings" SET
        "work_window_start" = COALESCE($1::time, "work_window_start"),
        "work_window_end" = COALESCE($2::time, "work_window_end"),
        "default_corridor_buffer_m" = COALESCE($3, "default_corridor_buffer_m"),
        "geofence_hysteresis_samples" = COALESCE($4, "geofence_hysteresis_samples"),
        "overspeed_kph" = COALESCE($5, "overspeed_kph"),
        "low_voltage_threshold" = COALESCE($6, "low_voltage_threshold"),
        "offline_minutes" = COALESCE($7, "offline_minutes"),
        "idle_alert_minutes" = COALESCE($8, "idle_alert_minutes"),
        "quiet_hours_start" = CASE WHEN $11::boolean THEN $9::time ELSE "quiet_hours_start" END,
        "quiet_hours_end" = CASE WHEN $11::boolean THEN $10::time ELSE "quiet_hours_end" END,
        "updated_at" = now()
       WHERE "id" = 1`,
      [
        body.workWindowStart ?? null,
        body.workWindowEnd ?? null,
        body.defaultCorridorBufferM ?? null,
        body.geofenceHysteresisSamples ?? null,
        body.overspeedKph ?? null,
        body.lowVoltageThreshold ?? null,
        body.offlineMinutes ?? null,
        body.idleAlertMinutes ?? null,
        quietStartParam,
        quietEndParam,
        touchQuiet,
      ],
    );
    return this.getSettings();
  }

  private async assignmentsForVehicle(vehicleId: string) {
    const slug = this.slug();
    const cached = this.assignCache.get(slug);
    const now = Date.now();
    if (cached && now - cached.at < 60_000) {
      return cached.rows.filter((r) =>
        // cache is per-tenant all assignments — reload filtered
        true,
      );
    }
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT g.*, vg."vehicle_id", vg."role", vg."is_required_corridor"
       FROM "${this.schema()}"."vehicle_geofences" vg
       JOIN "${this.schema()}"."geofences" g ON g."id" = vg."geofence_id"
       WHERE g."is_active" = true`,
    );
    this.assignCache.set(slug, { at: now, rows });
    return rows.filter(
      (r: { vehicle_id: string }) => r.vehicle_id === vehicleId,
    );
  }

  /** Called after each tracking point insert. */
  async evaluatePoint(input: {
    vehicleId: string;
    pointId: string;
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    recordedAt: Date;
    source?: string | null;
  }) {
    const slug = this.slug();
    if (!(await this.commercial.hasModule(slug, 'tracking_geofence'))) {
      return [];
    }
    await this.ensureTables();
    const settings = await this.getSettings();
    const hyst = Math.max(1, settings.geofenceHysteresisSamples);
    const fences = await this.assignmentsForVehicle(input.vehicleId);
    const point = { lat: input.latitude, lng: input.longitude };
    const events: Array<Record<string, unknown>> = [];
    const s = this.schema();

    for (const f of fences as Array<
      GeofenceRow & {
        vehicle_id: string;
        role: string;
        is_required_corridor: boolean;
      }
    >) {
      const geojson =
        typeof f.geojson === 'string' ? JSON.parse(f.geojson) : f.geojson;
      const inside = pointInFence(point, {
        geojson,
        type: f.type,
        radiusM: f.radius_m != null ? Number(f.radius_m) : null,
        bufferM: f.buffer_m != null ? Number(f.buffer_m) : null,
        centerLat: f.center_lat != null ? Number(f.center_lat) : null,
        centerLng: f.center_lng != null ? Number(f.center_lng) : null,
      });

      const stateRows = await this.dataSource.query(
        `SELECT * FROM "${s}"."vehicle_geofence_state"
         WHERE "vehicle_id" = $1 AND "geofence_id" = $2`,
        [input.vehicleId, f.id],
      );
      let state = stateRows[0] as
        | {
            is_inside: boolean;
            entered_at: Date | null;
            pending_inside: boolean | null;
            pending_count: number;
          }
        | undefined;

      if (!state) {
        await this.dataSource.query(
          `INSERT INTO "${s}"."vehicle_geofence_state"
            ("vehicle_id","geofence_id","is_inside","entered_at","pending_inside","pending_count")
           VALUES ($1,$2,$3,$4,$5,0)
           ON CONFLICT DO NOTHING`,
          [
            input.vehicleId,
            f.id,
            inside,
            inside ? input.recordedAt : null,
            null,
          ],
        );
        if (inside) {
          const ev = await this.insertEvent({
            vehicleId: input.vehicleId,
            geofenceId: f.id,
            pointId: input.pointId,
            eventType: 'enter',
            latitude: input.latitude,
            longitude: input.longitude,
            speedKph: input.speedKph,
            source: input.source,
            recordedAt: input.recordedAt,
          });
          events.push(ev);
          await this.maybeFireAlerts({
            trigger: f.type === 'forbidden' ? 'enter_forbidden' : 'enter_rank',
            vehicleId: input.vehicleId,
            geofenceId: f.id,
            fenceName: f.name,
            fenceType: f.type,
            source: input.source,
          });
        }
        continue;
      }

      if (inside === Boolean(state.is_inside)) {
        await this.dataSource.query(
          `UPDATE "${s}"."vehicle_geofence_state"
           SET "pending_inside" = NULL, "pending_count" = 0, "updated_at" = now()
           WHERE "vehicle_id" = $1 AND "geofence_id" = $2`,
          [input.vehicleId, f.id],
        );
        continue;
      }

      const pendingSame =
        state.pending_inside != null &&
        Boolean(state.pending_inside) === inside;
      const pendingCount = pendingSame ? Number(state.pending_count) + 1 : 1;

      if (pendingCount < hyst) {
        await this.dataSource.query(
          `UPDATE "${s}"."vehicle_geofence_state"
           SET "pending_inside" = $3, "pending_count" = $4, "updated_at" = now()
           WHERE "vehicle_id" = $1 AND "geofence_id" = $2`,
          [input.vehicleId, f.id, inside, pendingCount],
        );
        continue;
      }

      const eventType = inside ? 'enter' : 'exit';
      await this.dataSource.query(
        `UPDATE "${s}"."vehicle_geofence_state"
         SET "is_inside" = $3,
             "entered_at" = CASE WHEN $3 THEN $4 ELSE NULL END,
             "pending_inside" = NULL,
             "pending_count" = 0,
             "updated_at" = now()
         WHERE "vehicle_id" = $1 AND "geofence_id" = $2`,
        [input.vehicleId, f.id, inside, input.recordedAt],
      );
      const ev = await this.insertEvent({
        vehicleId: input.vehicleId,
        geofenceId: f.id,
        pointId: input.pointId,
        eventType,
        latitude: input.latitude,
        longitude: input.longitude,
        speedKph: input.speedKph,
        source: input.source,
        recordedAt: input.recordedAt,
      });
      events.push(ev);

      if (inside && f.type === 'forbidden') {
        await this.maybeFireAlerts({
          trigger: 'enter_forbidden',
          vehicleId: input.vehicleId,
          geofenceId: f.id,
          fenceName: f.name,
          fenceType: f.type,
          source: input.source,
        });
      }
    }

    for (const ev of events) {
      this.gateway.emitGeofenceEvent(slug, ev);
    }
    return events;
  }

  private async insertEvent(input: {
    vehicleId: string;
    geofenceId: string;
    pointId: string;
    eventType: string;
    latitude: number;
    longitude: number;
    speedKph?: number | null;
    source?: string | null;
    recordedAt: Date;
  }) {
    const rows = await this.dataSource.query(
      `INSERT INTO "${this.schema()}"."geofence_events"
        ("vehicle_id","geofence_id","point_id","event_type","latitude","longitude","speed_kph","source","recorded_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.vehicleId,
        input.geofenceId,
        input.pointId,
        input.eventType,
        input.latitude,
        input.longitude,
        input.speedKph ?? null,
        input.source ?? null,
        input.recordedAt,
      ],
    );
    return {
      id: rows[0].id,
      vehicleId: rows[0].vehicle_id,
      geofenceId: rows[0].geofence_id,
      eventType: rows[0].event_type,
      latitude: Number(rows[0].latitude),
      longitude: Number(rows[0].longitude),
      recordedAt: rows[0].recorded_at,
    };
  }

  async listEvents(opts: {
    from?: string;
    to?: string;
    vehicleId?: string;
    limit?: number;
  }) {
    await this.ensureTables();
    const from = opts.from
      ? new Date(opts.from)
      : new Date(Date.now() - 24 * 3600_000);
    const to = opts.to ? new Date(opts.to) : new Date();
    const params: unknown[] = [from, to];
    let filter = '';
    if (opts.vehicleId) {
      params.push(opts.vehicleId);
      filter = `AND e."vehicle_id" = $${params.length}`;
    }
    params.push(Math.min(500, opts.limit ?? 100));
    const rows = await this.dataSource.query(
      `SELECT e.*, g."name" AS geofence_name, g."type" AS geofence_type, g."color"
       FROM "${this.schema()}"."geofence_events" e
       LEFT JOIN "${this.schema()}"."geofences" g ON g."id" = e."geofence_id"
       WHERE e."recorded_at" >= $1 AND e."recorded_at" <= $2 ${filter}
       ORDER BY e."recorded_at" DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      vehicleId: r.vehicle_id,
      geofenceId: r.geofence_id,
      geofenceName: r.geofence_name,
      geofenceType: r.geofence_type,
      color: r.color,
      eventType: r.event_type,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      speedKph: r.speed_kph != null ? Number(r.speed_kph) : null,
      recordedAt: r.recorded_at,
    }));
  }

  async listDaily(opts: { from?: string; to?: string; vehicleId?: string }) {
    await this.ensureTables();
    const from = opts.from ?? johannesburgToday();
    const to = opts.to ?? from;
    const params: unknown[] = [from, to];
    let filter = '';
    if (opts.vehicleId) {
      params.push(opts.vehicleId);
      filter = `AND "vehicle_id" = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."vehicle_geofence_daily"
       WHERE "day" >= $1::date AND "day" <= $2::date ${filter}
       ORDER BY "day" DESC`,
      params,
    );
    return {
      from,
      to,
      vehicles: rows.map((r: Record<string, unknown>) => ({
        day: String(r.day).slice(0, 10),
        vehicleId: r.vehicle_id,
        vehicleLabel: r.vehicle_label,
        pointCount: Number(r.point_count ?? 0),
        rankDwellSeconds: Number(r.rank_dwell_seconds ?? 0),
        depotDwellSeconds: Number(r.depot_dwell_seconds ?? 0),
        corridorSeconds: Number(r.corridor_seconds ?? 0),
        offCorridorSeconds: Number(r.off_corridor_seconds ?? 0),
        offCorridorKm:
          r.off_corridor_km != null ? Number(r.off_corridor_km) : null,
        forbiddenSeconds: Number(r.forbidden_seconds ?? 0),
        afterHoursOutsideHomeKm:
          r.after_hours_outside_home_km != null
            ? Number(r.after_hours_outside_home_km)
            : null,
        enterCount: Number(r.enter_count ?? 0),
        exitCount: Number(r.exit_count ?? 0),
        longestRankDwellSeconds: Number(r.longest_rank_dwell_seconds ?? 0),
        offCorridorPct:
          r.off_corridor_pct != null ? Number(r.off_corridor_pct) : null,
        computedAt: r.computed_at,
      })),
    };
  }

  async recomputeVehicleDay(day: string, vehicleId: string) {
    await this.ensureTables();
    const s = this.schema();
    const { from, to } = johannesburgDayBounds(day);
    const settings = await this.getSettings();
    const vehicles = await this.dataSource.query(
      `SELECT "id","label" FROM "${s}"."vehicles" WHERE "id" = $1`,
      [vehicleId],
    );
    if (!vehicles[0]) return null;
    const points = await this.dataSource.query(
      `SELECT * FROM "${s}"."gps_tracking_points"
       WHERE "vehicle_id" = $1 AND "recorded_at" >= $2 AND "recorded_at" <= $3
         AND COALESCE("source",'') <> 'simulate'
       ORDER BY "recorded_at" ASC`,
      [vehicleId, from, to],
    );
    const assigns = await this.dataSource.query(
      `SELECT g.*, vg."role", vg."is_required_corridor"
       FROM "${s}"."vehicle_geofences" vg
       JOIN "${s}"."geofences" g ON g."id" = vg."geofence_id"
       WHERE vg."vehicle_id" = $1 AND g."is_active" = true`,
      [vehicleId],
    );

    let rankDwell = 0;
    let depotDwell = 0;
    let corridorSec = 0;
    let offCorridorSec = 0;
    let offCorridorKm = 0;
    let forbiddenSec = 0;
    let afterHoursKm = 0;
    let longestRank = 0;
    let currentRankStreak = 0;
    const hasRequiredCorridor = assigns.some(
      (a: { is_required_corridor: boolean }) => a.is_required_corridor,
    );

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const pt = { lat: Number(p.latitude), lng: Number(p.longitude) };
      let dt = 10;
      if (i > 0) {
        dt = Math.min(
          120,
          Math.max(
            5,
            (new Date(p.recorded_at).getTime() -
              new Date(points[i - 1].recorded_at).getTime()) /
              1000,
          ),
        );
      }
      let inRank = false;
      let inDepot = false;
      let inCorridor = false;
      let inForbidden = false;
      let inHome = false;
      let requiredCorridorHit = !hasRequiredCorridor;

      for (const a of assigns) {
        const geojson =
          typeof a.geojson === 'string' ? JSON.parse(a.geojson) : a.geojson;
        const inside = pointInFence(pt, {
          geojson,
          type: a.type,
          radiusM: a.radius_m != null ? Number(a.radius_m) : null,
          bufferM: a.buffer_m != null ? Number(a.buffer_m) : null,
          centerLat: a.center_lat != null ? Number(a.center_lat) : null,
          centerLng: a.center_lng != null ? Number(a.center_lng) : null,
        });
        if (!inside) continue;
        if (a.type === 'rank' || a.role === 'work_rank') inRank = true;
        if (a.type === 'depot' || a.role === 'home') {
          inDepot = true;
          if (a.role === 'home') inHome = true;
        }
        if (a.type === 'corridor' || a.role === 'corridor') {
          inCorridor = true;
          if (a.is_required_corridor) requiredCorridorHit = true;
        }
        if (a.type === 'forbidden' || a.role === 'forbidden')
          inForbidden = true;
      }

      if (inRank) {
        rankDwell += dt;
        currentRankStreak += dt;
        longestRank = Math.max(longestRank, currentRankStreak);
      } else currentRankStreak = 0;
      if (inDepot) depotDwell += dt;
      if (inCorridor) corridorSec += dt;
      if (inForbidden) forbiddenSec += dt;

      if (hasRequiredCorridor && !requiredCorridorHit && !inRank && !inDepot) {
        offCorridorSec += dt;
        if (i > 0) {
          const prev = points[i - 1];
          const dist =
            haversineKmApprox(
              Number(prev.latitude),
              Number(prev.longitude),
              Number(p.latitude),
              Number(p.longitude),
            );
          if (dist < 2) offCorridorKm += dist;
        }
      }

      const localHour = jhbHour(new Date(p.recorded_at));
      const startH = parseInt(settings.workWindowStart.slice(0, 2), 10);
      const endH = parseInt(settings.workWindowEnd.slice(0, 2), 10);
      const afterHours = localHour < startH || localHour >= endH;
      if (afterHours && !inHome && i > 0) {
        const prev = points[i - 1];
        const dist = haversineKmApprox(
          Number(prev.latitude),
          Number(prev.longitude),
          Number(p.latitude),
          Number(p.longitude),
        );
        if (dist < 2) afterHoursKm += dist;
      }
    }

    const events = await this.dataSource.query(
      `SELECT "event_type", COUNT(*)::int AS c
       FROM "${s}"."geofence_events"
       WHERE "vehicle_id" = $1 AND "recorded_at" >= $2 AND "recorded_at" <= $3
       GROUP BY "event_type"`,
      [vehicleId, from, to],
    );
    let enterCount = 0;
    let exitCount = 0;
    for (const e of events) {
      if (e.event_type === 'enter') enterCount = e.c;
      if (e.event_type === 'exit') exitCount = e.c;
    }

    const denom = corridorSec + offCorridorSec;
    const offPct = denom > 0 ? (offCorridorSec / denom) * 100 : null;

    await this.dataSource.query(
      `INSERT INTO "${s}"."vehicle_geofence_daily" (
        "day","vehicle_id","vehicle_label","point_count",
        "rank_dwell_seconds","depot_dwell_seconds","corridor_seconds",
        "off_corridor_seconds","off_corridor_km","forbidden_seconds",
        "after_hours_outside_home_km","enter_count","exit_count",
        "longest_rank_dwell_seconds","off_corridor_pct","computed_at"
      ) VALUES (
        $1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()
      )
      ON CONFLICT ("day","vehicle_id") DO UPDATE SET
        "vehicle_label" = EXCLUDED."vehicle_label",
        "point_count" = EXCLUDED."point_count",
        "rank_dwell_seconds" = EXCLUDED."rank_dwell_seconds",
        "depot_dwell_seconds" = EXCLUDED."depot_dwell_seconds",
        "corridor_seconds" = EXCLUDED."corridor_seconds",
        "off_corridor_seconds" = EXCLUDED."off_corridor_seconds",
        "off_corridor_km" = EXCLUDED."off_corridor_km",
        "forbidden_seconds" = EXCLUDED."forbidden_seconds",
        "after_hours_outside_home_km" = EXCLUDED."after_hours_outside_home_km",
        "enter_count" = EXCLUDED."enter_count",
        "exit_count" = EXCLUDED."exit_count",
        "longest_rank_dwell_seconds" = EXCLUDED."longest_rank_dwell_seconds",
        "off_corridor_pct" = EXCLUDED."off_corridor_pct",
        "computed_at" = now()`,
      [
        day,
        vehicleId,
        vehicles[0].label,
        points.length,
        Math.round(rankDwell),
        Math.round(depotDwell),
        Math.round(corridorSec),
        Math.round(offCorridorSec),
        Number(offCorridorKm.toFixed(3)),
        Math.round(forbiddenSec),
        Number(afterHoursKm.toFixed(3)),
        enterCount,
        exitCount,
        Math.round(longestRank),
        offPct != null ? Number(offPct.toFixed(1)) : null,
      ],
    );

    // Duration-based alerts
    if (offCorridorSec >= 5 * 60) {
      await this.maybeFireAlerts({
        trigger: 'off_corridor_minutes',
        vehicleId,
        geofenceId: null,
        fenceName: 'corridor',
        fenceType: 'corridor',
        source: 'rollup',
        minutes: Math.round(offCorridorSec / 60),
      });
    }
    if (longestRank >= 30 * 60) {
      await this.maybeFireAlerts({
        trigger: 'rank_dwell_minutes',
        vehicleId,
        geofenceId: null,
        fenceName: 'rank',
        fenceType: 'rank',
        source: 'rollup',
        minutes: Math.round(longestRank / 60),
      });
    }

    return { day, vehicleId, pointCount: points.length, offCorridorKm };
  }

  async recomputeDay(day: string) {
    await this.ensureTables();
    const { from, to } = johannesburgDayBounds(day);
    const ids = await this.dataSource.query(
      `SELECT DISTINCT "vehicle_id" FROM "${this.schema()}"."gps_tracking_points"
       WHERE "recorded_at" >= $1 AND "recorded_at" <= $2 AND "vehicle_id" IS NOT NULL
       UNION
       SELECT DISTINCT "vehicle_id" FROM "${this.schema()}"."vehicle_geofences"`,
      [from, to],
    );
    let n = 0;
    for (const row of ids) {
      await this.recomputeVehicleDay(day, row.vehicle_id);
      n += 1;
    }
    return { day, vehicles: n };
  }

  async runForAllTenants(which: 'today' | 'yesterday') {
    const day =
      which === 'today' ? johannesburgToday() : johannesburgYesterday();
    const tenants: Array<{ slug: string }> = await this.dataSource.query(
      `SELECT "slug" FROM "platform"."tenants" WHERE "is_active" = true`,
    );
    for (const t of tenants) {
      try {
        await this.tenantContext.runAsync(t.slug, async () => {
          if (!(await this.commercial.hasModule(t.slug, 'tracking_geofence')))
            return;
          await this.ensureTables();
          await this.recomputeDay(day);
        });
      } catch (e) {
        this.logger.warn(
          `Geofence rollup fail ${t.slug}: ${(e as Error).message}`,
        );
      }
    }
    return { day, tenants: tenants.length };
  }

  // --- alerts ---
  async listAlertRules() {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."geofence_alert_rules" ORDER BY "name"`,
    );
    return rows.map((r: Record<string, unknown>) => this.toRuleDto(r));
  }

  async createAlertRule(body: {
    name: string;
    trigger: string;
    thresholdMinutes?: number;
    channels?: string[];
    cooldownMinutes?: number;
  }) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `INSERT INTO "${this.schema()}"."geofence_alert_rules"
        ("name","trigger","threshold_minutes","channels","cooldown_minutes")
       VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *`,
      [
        body.name,
        body.trigger,
        body.thresholdMinutes ?? 5,
        JSON.stringify(body.channels ?? ['in_app']),
        body.cooldownMinutes ?? 30,
      ],
    );
    return this.toRuleDto(rows[0]);
  }

  async updateAlertRule(
    id: string,
    body: Partial<{
      name: string;
      trigger: string;
      thresholdMinutes: number;
      channels: string[];
      isActive: boolean;
      cooldownMinutes: number;
    }>,
  ) {
    await this.ensureTables();
    const rows = await this.dataSource.query(
      `UPDATE "${this.schema()}"."geofence_alert_rules" SET
        "name" = COALESCE($2, "name"),
        "trigger" = COALESCE($3, "trigger"),
        "threshold_minutes" = COALESCE($4, "threshold_minutes"),
        "channels" = COALESCE($5::jsonb, "channels"),
        "is_active" = COALESCE($6, "is_active"),
        "cooldown_minutes" = COALESCE($7, "cooldown_minutes"),
        "updated_at" = now()
       WHERE "id" = $1 RETURNING *`,
      [
        id,
        body.name ?? null,
        body.trigger ?? null,
        body.thresholdMinutes ?? null,
        body.channels ? JSON.stringify(body.channels) : null,
        body.isActive ?? null,
        body.cooldownMinutes ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Rule not found');
    return this.toRuleDto(rows[0]);
  }

  async deleteAlertRule(id: string) {
    await this.ensureTables();
    await this.dataSource.query(
      `DELETE FROM "${this.schema()}"."geofence_alert_rules" WHERE "id" = $1`,
      [id],
    );
    return { deleted: true };
  }

  async listAlertFires(limit = 50) {
    await this.ensureTables();
    return this.dataSource.query(
      `SELECT f.*, r."name" AS rule_name, r."trigger"
       FROM "${this.schema()}"."geofence_alert_fires" f
       JOIN "${this.schema()}"."geofence_alert_rules" r ON r."id" = f."rule_id"
       ORDER BY f."fired_at" DESC LIMIT $1`,
      [Math.min(200, limit)],
    );
  }

  private async maybeFireAlerts(opts: {
    trigger: string;
    vehicleId: string;
    geofenceId: string | null;
    fenceName: string;
    fenceType: string;
    source?: string | null;
    minutes?: number;
  }) {
    if (opts.source === 'simulate') return;
    const slug = this.slug();
    if (!(await this.commercial.hasModule(slug, 'tracking_alerts'))) return;
    await this.ensureTables();
    const rules = await this.dataSource.query(
      `SELECT * FROM "${this.schema()}"."geofence_alert_rules"
       WHERE "is_active" = true AND "trigger" = $1`,
      [opts.trigger],
    );
    for (const rule of rules) {
      if (
        opts.minutes != null &&
        opts.minutes < Number(rule.threshold_minutes ?? 0)
      ) {
        continue;
      }
      const cooldown = Number(rule.cooldown_minutes ?? 30);
      const recent = await this.dataSource.query(
        `SELECT 1 FROM "${this.schema()}"."geofence_alert_fires"
         WHERE "rule_id" = $1 AND "vehicle_id" = $2
           AND "fired_at" > now() - ($3 || ' minutes')::interval
         LIMIT 1`,
        [rule.id, opts.vehicleId, String(cooldown)],
      );
      if (recent.length) continue;
      const labelRows = await this.dataSource.query(
        `SELECT "label" FROM "${this.schema()}"."vehicles" WHERE "id" = $1 LIMIT 1`,
        [opts.vehicleId],
      );
      const label = labelRows[0]?.label
        ? String(labelRows[0].label)
        : 'Vehicle';
      let message: string;
      switch (opts.trigger) {
        case 'enter_forbidden':
          message = `${label} entered forbidden zone (${opts.fenceName})`;
          break;
        case 'enter_rank':
          message = `${label} entered rank (${opts.fenceName})`;
          break;
        case 'off_corridor_minutes':
          message = `${label} off corridor (${opts.fenceName})${
            opts.minutes != null ? ` — ${opts.minutes} min` : ''
          }`;
          break;
        case 'rank_dwell_minutes':
          message = `${label} dwelling at rank (${opts.fenceName})${
            opts.minutes != null ? ` — ${opts.minutes} min` : ''
          }`;
          break;
        default:
          message = `Geofence alert (${rule.name}): ${opts.trigger} on ${opts.fenceName}${
            opts.minutes != null ? ` — ${opts.minutes} min` : ''
          }`;
      }
      await this.dataSource.query(
        `INSERT INTO "${this.schema()}"."geofence_alert_fires"
          ("rule_id","vehicle_id","geofence_id","message")
         VALUES ($1,$2,$3,$4)`,
        [rule.id, opts.vehicleId, opts.geofenceId, message],
      );
      const channels =
        typeof rule.channels === 'string'
          ? JSON.parse(rule.channels)
          : rule.channels;
      if (Array.isArray(channels) && channels.includes('email')) {
        try {
          await this.trackingEvents.deliverAlertEmail({
            message,
            trigger: opts.trigger,
            ruleName: rule.name ?? null,
            vehicleId: opts.vehicleId,
            severity: 'warning',
            recordedAt: new Date(),
          });
        } catch {
          /* ignore email failures */
        }
      }
    }
  }

  private toFenceDto(r: GeofenceRow | Record<string, unknown>) {
    const row = r as Record<string, unknown>;
    const geojson =
      typeof row.geojson === 'string'
        ? JSON.parse(row.geojson)
        : row.geojson;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      geojson,
      centerLat: row.center_lat != null ? Number(row.center_lat) : null,
      centerLng: row.center_lng != null ? Number(row.center_lng) : null,
      radiusM: row.radius_m != null ? Number(row.radius_m) : null,
      bufferM: row.buffer_m != null ? Number(row.buffer_m) : null,
      color: row.color,
      isActive: Boolean(row.is_active),
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toRuleDto(r: Record<string, unknown>) {
    const channels =
      typeof r.channels === 'string' ? JSON.parse(r.channels) : r.channels;
    return {
      id: r.id,
      name: r.name,
      trigger: r.trigger,
      thresholdMinutes: Number(r.threshold_minutes ?? 0),
      channels: channels ?? ['in_app'],
      isActive: Boolean(r.is_active),
      cooldownMinutes: Number(r.cooldown_minutes ?? 30),
    };
  }
}

function haversineKmApprox(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function jhbHour(d: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    hour12: false,
  });
  return Number(fmt.format(d));
}
