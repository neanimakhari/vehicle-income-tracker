import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantNotificationsModule } from '../tenant-notifications/tenant-notifications.module';
import { TenantEventsModule } from '../tenant-events/tenant-events.module';
import { TenantIncidentsController } from './tenant-incidents.controller';
import { TenantIncidentsService } from './tenant-incidents.service';

@Module({
  imports: [TenancyModule, TenantNotificationsModule, TenantEventsModule],
  controllers: [TenantIncidentsController],
  providers: [TenantIncidentsService],
})
export class TenantIncidentsModule {}
