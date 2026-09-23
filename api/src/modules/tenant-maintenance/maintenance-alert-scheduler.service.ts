import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { CommercialService } from '../commercial/commercial.service';
import { TenantNotificationsService } from '../tenant-notifications/tenant-notifications.service';
import { TenantMaintenanceService } from './tenant-maintenance.service';

/**
 * Daily: publish overdue / due_soon maintenance into the notification centre
 * for drivers (recent income on that vehicle) and tenant admins.
 */
@Injectable()
export class MaintenanceAlertSchedulerService {
  private readonly logger = new Logger(MaintenanceAlertSchedulerService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly commercial: CommercialService,
    private readonly notifications: TenantNotificationsService,
    private readonly maintenance: TenantMaintenanceService,
  ) {}

  /** 07:15 local server time — once per day is enough with 24h dedupe. */
  @Cron('15 7 * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.dataSource
        .getRepository(Tenant)
        .find({ where: { isActive: true } });
      for (const tenant of tenants) {
        try {
          if (!(await this.commercial.hasModule(tenant.slug, 'notifications'))) {
            continue;
          }
          await this.tenantContext.runAsync(tenant.slug, async () => {
            await this.processTenant(tenant.slug);
          });
        } catch (err) {
          this.logger.warn(
            `Maintenance alerts failed for ${tenant.slug}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async processTenant(slug: string) {
    const tasks = await this.maintenance.findAll();
    const today = new Date().toISOString().slice(0, 10);
    for (const task of tasks as Array<Record<string, unknown>>) {
      const status = String(task.status ?? '');
      if (status !== 'overdue' && status !== 'due_soon') continue;
      const id = String(task.id);
      const label = String(task.vehicleLabel ?? task.vehicle_label ?? 'Vehicle');
      const title =
        status === 'overdue'
          ? `Maintenance overdue — ${label}`
          : `Maintenance due soon — ${label}`;
      const message = String(
        task.notes ||
          `${label} needs ${task.maintenanceType || task.maintenance_type || 'service'} (${status.replace('_', ' ')}).`,
      );
      const dedupeBase = `maintenance:${id}:${status}:${today}`;

      // Admins
      await this.notifications.publish({
        title,
        message,
        targetRole: 'TENANT_ADMIN',
        source: 'maintenance',
        deepLink: 'vitapp://maintenance',
        meta: { dedupeKey: `${dedupeBase}:admins`, taskId: id, status },
        push: true,
      });

      // Drivers who recently logged this vehicle
      const schema = `tenant_${slug.replace(/-/g, '_')}`;
      const drivers: Array<{ driver_id: string }> = await this.dataSource.query(
        `SELECT DISTINCT driver_id
         FROM "${schema}"."vehicle_incomes"
         WHERE vehicle = $1
           AND driver_id IS NOT NULL
           AND logged_on > now() - interval '14 days'
         LIMIT 20`,
        [label],
      );
      for (const d of drivers) {
        if (!d.driver_id) continue;
        await this.notifications.publish({
          title,
          message,
          targetRole: 'TENANT_USER',
          targetUserId: d.driver_id,
          source: 'maintenance',
          deepLink: 'vitapp://maintenance',
          meta: {
            dedupeKey: `${dedupeBase}:${d.driver_id}`,
            taskId: id,
            status,
          },
          push: true,
        });
      }
    }
  }
}
