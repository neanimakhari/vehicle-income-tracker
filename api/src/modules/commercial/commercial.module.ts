import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureModuleEntity } from './feature-module.entity';
import { PlanEntity } from './plan.entity';
import { PlanModuleEntity } from './plan-module.entity';
import { TenantEntitlementEntity } from './tenant-entitlement.entity';
import { CommercialService } from './commercial.service';
import { CommercialController } from './commercial.controller';
import { ModuleEntitlementGuard } from './module-entitlement.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { TenancyModule } from '../../tenancy/tenancy.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeatureModuleEntity,
      PlanEntity,
      PlanModuleEntity,
      TenantEntitlementEntity,
    ]),
    forwardRef(() => TenantsModule),
    TenancyModule,
  ],
  controllers: [CommercialController],
  providers: [CommercialService, ModuleEntitlementGuard],
  exports: [CommercialService, ModuleEntitlementGuard],
})
export class CommercialModule {}
