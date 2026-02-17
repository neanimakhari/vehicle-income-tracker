import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { TenantMaintenanceController } from './tenant-maintenance.controller';
import { TenantMaintenanceService } from './tenant-maintenance.service';
import { TenantMaintenanceTask } from './tenant-maintenance.entity';

@Module({
  imports: [TenancyModule, AuditModule, TypeOrmModule.forFeature([TenantMaintenanceTask])],
  controllers: [TenantMaintenanceController],
  providers: [TenantMaintenanceService],
})
export class TenantMaintenanceModule {}

