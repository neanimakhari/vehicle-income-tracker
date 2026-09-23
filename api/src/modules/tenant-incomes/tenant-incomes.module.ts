import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantIncomesController } from './tenant-incomes.controller';
import { TenantIncomesService } from './tenant-incomes.service';
import { AuditModule } from '../audit/audit.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TenantIncome } from './tenant-income.entity';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TenancyModule,
    AuditModule,
    WebhooksModule,
    TypeOrmModule.forFeature([TenantIncome]),
    forwardRef(() => TenantsModule),
  ],
  controllers: [TenantIncomesController],
  providers: [TenantIncomesService],
  exports: [TenantIncomesService],
})
export class TenantIncomesModule {}

