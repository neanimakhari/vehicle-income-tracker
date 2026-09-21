import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { CommercialService } from '../commercial/commercial.service';
import { TrackingEventsService } from './tracking-events.service';

/**
 * Detects trackers that have gone silent past tenant offline_minutes.
 */
@Injectable()
export class TrackingOfflineScheduler {
  private readonly logger = new Logger(TrackingOfflineScheduler.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly commercial: CommercialService,
    private readonly trackingEvents: TrackingEventsService,
  ) {}

  @Cron('*/5 * * * *')
  async scan() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants: Array<{ slug: string }> = await this.dataSource.query(
        `SELECT "slug" FROM "platform"."tenants" WHERE "is_active" = true`,
      );
      for (const t of tenants) {
        try {
          if (!(await this.commercial.hasModule(t.slug, 'tracking_live'))) {
            continue;
          }
          await this.tenantContext.runAsync(t.slug, async () => {
            await this.trackingEvents.scanOfflineDevices();
          });
        } catch (e) {
          this.logger.warn(
            `Offline scan fail ${t.slug}: ${(e as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
