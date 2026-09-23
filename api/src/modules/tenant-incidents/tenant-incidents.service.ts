import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantNotificationsService } from '../tenant-notifications/tenant-notifications.service';

export type IncidentStatus = 'open' | 'ack' | 'closed';

@Injectable()
export class TenantIncidentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly notifications: TenantNotificationsService,
  ) {}

  private async ensureTable(schema: string): Promise<void> {
    await this.dataSource.query(
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
  }

  async create(
    driverId: string,
    input: {
      vehicle?: string | null;
      lat?: number | null;
      lng?: number | null;
      note?: string | null;
    },
  ) {
    const schema = this.tenantScope.getTenantSchema();
    await this.ensureTable(schema);

    const note = input.note?.trim() || null;
    const vehicle = input.vehicle?.trim() || null;
    const lat =
      input.lat != null && Number.isFinite(Number(input.lat))
        ? Number(input.lat)
        : null;
    const lng =
      input.lng != null && Number.isFinite(Number(input.lng))
        ? Number(input.lng)
        : null;

    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}"."incidents"
         (driver_id, vehicle, lat, lng, note, status)
       VALUES ($1, $2, $3, $4, $5, 'open')
       RETURNING id, driver_id, vehicle, lat, lng, note, status,
                 created_at, acked_at, acked_by, closed_at`,
      [driverId, vehicle, lat, lng, note],
    );
    const incident = this.mapRow(rows[0] as Record<string, unknown>);

    const driverName = await this.resolveDriverName(schema, driverId);
    const loc =
      lat != null && lng != null
        ? ` near ${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : '';
    const title = 'Panic alert';
    const message = `${driverName} pressed Panic${vehicle ? ` (${vehicle})` : ''}${loc}${
      note ? `: ${note}` : ''
    }`;

    try {
      await this.notifications.publish(
        {
          title,
          message,
          targetRole: 'TENANT_ADMIN',
          source: 'incident',
          deepLink: `/incidents?id=${incident.id}`,
          push: true,
          meta: {
            incidentId: incident.id,
            driverId,
            dedupeKey: `incident:${incident.id}`,
          },
        },
        driverId,
      );
    } catch {
      // Incident row is already saved; push failure must not roll back.
    }

    return incident;
  }

  async list(status?: IncidentStatus) {
    const schema = this.tenantScope.getTenantSchema();
    await this.ensureTable(schema);
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE i.status = $1`;
    }
    const rows = await this.dataSource.query(
      `SELECT i.id, i.driver_id, i.vehicle, i.lat, i.lng, i.note, i.status,
              i.created_at, i.acked_at, i.acked_by, i.closed_at,
              u.first_name, u.last_name, u.email
       FROM "${schema}"."incidents" i
       LEFT JOIN "${schema}"."users" u ON u.id = i.driver_id
       ${where}
       ORDER BY i.created_at DESC
       LIMIT 200`,
      params,
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      ...this.mapRow(r),
      driverName: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null,
      driverEmail: r.email != null ? String(r.email) : null,
    }));
  }

  async ack(id: string, actorUserId: string) {
    return this.setStatus(id, 'ack', actorUserId);
  }

  async close(id: string, actorUserId: string) {
    return this.setStatus(id, 'closed', actorUserId);
  }

  private async setStatus(
    id: string,
    status: 'ack' | 'closed',
    actorUserId: string,
  ) {
    const schema = this.tenantScope.getTenantSchema();
    await this.ensureTable(schema);
    const existing = await this.dataSource.query(
      `SELECT id, status FROM "${schema}"."incidents" WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!existing.length) throw new NotFoundException('Incident not found');

    const rows = await this.dataSource.query(
      status === 'ack'
        ? `UPDATE "${schema}"."incidents"
           SET status = 'ack',
               acked_at = COALESCE(acked_at, now()),
               acked_by = COALESCE(acked_by, $2)
           WHERE id = $1
           RETURNING id, driver_id, vehicle, lat, lng, note, status,
                     created_at, acked_at, acked_by, closed_at`
        : `UPDATE "${schema}"."incidents"
           SET status = 'closed',
               closed_at = COALESCE(closed_at, now()),
               acked_at = COALESCE(acked_at, now()),
               acked_by = COALESCE(acked_by, $2)
           WHERE id = $1
           RETURNING id, driver_id, vehicle, lat, lng, note, status,
                     created_at, acked_at, acked_by, closed_at`,
      [id, actorUserId],
    );
    return this.mapRow(rows[0] as Record<string, unknown>);
  }

  private async resolveDriverName(
    schema: string,
    driverId: string,
  ): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT first_name, last_name, email FROM "${schema}"."users" WHERE id = $1 LIMIT 1`,
      [driverId],
    );
    if (!rows.length) return 'A driver';
    const r = rows[0] as Record<string, unknown>;
    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
    return name || String(r.email ?? 'A driver');
  }

  private mapRow(r: Record<string, unknown>) {
    if (!r?.id) throw new BadRequestException('Invalid incident row');
    return {
      id: String(r.id),
      driverId: String(r.driver_id),
      vehicle: r.vehicle != null ? String(r.vehicle) : null,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
      note: r.note != null ? String(r.note) : null,
      status: String(r.status) as IncidentStatus,
      createdAt: r.created_at,
      ackedAt: r.acked_at ?? null,
      ackedBy: r.acked_by != null ? String(r.acked_by) : null,
      closedAt: r.closed_at ?? null,
    };
  }
}
