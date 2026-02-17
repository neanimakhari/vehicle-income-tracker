import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { TenantVehiclesController } from './tenant-vehicles.controller';
import { TenantVehiclesService } from './tenant-vehicles.service';
import { TenantVehicle } from './tenant-vehicle.entity';

@Module({
  imports: [TenancyModule, AuditModule, TypeOrmModule.forFeature([TenantVehicle])],
  controllers: [TenantVehiclesController],
  providers: [TenantVehiclesService],
})
export class TenantVehiclesModule {}



