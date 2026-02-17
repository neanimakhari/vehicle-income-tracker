import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantIncomesController } from './tenant-incomes.controller';
import { TenantIncomesService } from './tenant-incomes.service';
import { AuditModule } from '../audit/audit.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TenantIncome } from './tenant-income.entity';

@Module({
  imports: [TenancyModule, AuditModule, WebhooksModule, TypeOrmModule.forFeature([TenantIncome])],
  controllers: [TenantIncomesController],
  providers: [TenantIncomesService],
})
export class TenantIncomesModule {}

