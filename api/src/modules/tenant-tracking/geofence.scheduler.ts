import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GeofenceService } from './geofence.service';

@Injectable()
export class GeofenceScheduler {
  private readonly logger = new Logger(GeofenceScheduler.name);
  private running = false;

  constructor(private readonly geofences: GeofenceService) {}

  @Cron('20 * * * *')
  async rollupToday() {
    await this.run('today');
  }

  @Cron('25 23 * * *')
  async rollupYesterday() {
    await this.run('yesterday');
  }

  private async run(which: 'today' | 'yesterday') {
    if (this.running) {
      this.logger.warn(`Skip geofence ${which} — already running`);
      return;
    }
    this.running = true;
    try {
      const result = await this.geofences.runForAllTenants(which);
      this.logger.log(
        `Geofence rollup ${which} day=${result.day} tenants=${result.tenants}`,
      );
    } catch (e) {
      this.logger.error(`Geofence rollup ${which}: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
