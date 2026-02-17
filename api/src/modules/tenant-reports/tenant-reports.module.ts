import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantReportsController } from './tenant-reports.controller';
import { TenantReportsService } from './tenant-reports.service';
import { TenantIncome } from '../tenant-incomes/tenant-income.entity';
import { EmailModule } from '../email/email.module';
import { MonthlyReportSchedulerService } from './monthly-report-scheduler.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TenancyModule,
    TypeOrmModule.forFeature([TenantIncome]),
    EmailModule,
    forwardRef(() => TenantsModule),
  ],
  controllers: [TenantReportsController],
  providers: [TenantReportsService, MonthlyReportSchedulerService],
})
export class TenantReportsModule {}



