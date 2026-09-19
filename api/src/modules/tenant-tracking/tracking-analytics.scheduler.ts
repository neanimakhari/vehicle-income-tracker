import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrackingAnalyticsService } from './tracking-analytics.service';

@Injectable()
export class TrackingAnalyticsScheduler {
  private readonly logger = new Logger(TrackingAnalyticsScheduler.name);
  private running = false;

  constructor(private readonly analytics: TrackingAnalyticsService) {}

  /** Hourly: refresh “today so far” rollups (Africa/Johannesburg). */
  @Cron('15 * * * *')
  async rollupToday() {
    await this.run('today');
  }

  /** Nightly 01:20 SAST ≈ 23:20 UTC — finalize yesterday. */
  @Cron('20 23 * * *')
  async rollupYesterday() {
    await this.run('yesterday');
  }

  private async run(which: 'today' | 'yesterday') {
    if (this.running) {
      this.logger.warn(`Skip ${which} rollup — already running`);
      return;
    }
    this.running = true;
    try {
      const result = await this.analytics.runForAllTenants(which);
      this.logger.log(
        `Tracking analytics ${which} done day=${result.day} tenants=${result.tenants}`,
      );
    } catch (e) {
      this.logger.error(
        `Tracking analytics ${which} failed: ${(e as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
