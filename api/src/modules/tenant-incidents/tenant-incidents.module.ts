import { Module } from '@nestjs/common';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantNotificationsModule } from '../tenant-notifications/tenant-notifications.module';
import { TenantIncidentsController } from './tenant-incidents.controller';
import { TenantIncidentsService } from './tenant-incidents.service';

@Module({
  imports: [TenancyModule, TenantNotificationsModule],
  controllers: [TenantIncidentsController],
  providers: [TenantIncidentsService],
})
export class TenantIncidentsModule {}
