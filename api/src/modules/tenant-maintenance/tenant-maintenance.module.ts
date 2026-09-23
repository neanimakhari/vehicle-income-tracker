import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { TenantNotificationsModule } from '../tenant-notifications/tenant-notifications.module';
import { Tenant } from '../tenants/tenant.entity';
import { TenantMaintenanceController } from './tenant-maintenance.controller';
import { TenantMaintenanceService } from './tenant-maintenance.service';
import { TenantMaintenanceTask } from './tenant-maintenance.entity';
import { MaintenanceAlertSchedulerService } from './maintenance-alert-scheduler.service';

@Module({
  imports: [
    TenancyModule,
    AuditModule,
    CommercialModule,
    TenantNotificationsModule,
    TypeOrmModule.forFeature([TenantMaintenanceTask, Tenant]),
  ],
  controllers: [TenantMaintenanceController],
  providers: [TenantMaintenanceService, MaintenanceAlertSchedulerService],
})
export class TenantMaintenanceModule {}
