import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { TenantReportsController } from './tenant-reports.controller';
import { TenantReportsService } from './tenant-reports.service';
import { TenantIncome } from '../tenant-incomes/tenant-income.entity';
import { EmailModule } from '../email/email.module';
import { MonthlyReportSchedulerService } from './monthly-report-scheduler.service';
import { MissingIncomeReminderSchedulerService } from './missing-income-reminder-scheduler.service';
import { TenantsModule } from '../tenants/tenants.module';
import { CommercialModule } from '../commercial/commercial.module';
import { TenantIncomesModule } from '../tenant-incomes/tenant-incomes.module';
import { TenantNotificationsModule } from '../tenant-notifications/tenant-notifications.module';

@Module({
  imports: [
    TenancyModule,
    TypeOrmModule.forFeature([TenantIncome]),
    EmailModule,
    forwardRef(() => TenantsModule),
    CommercialModule,
    forwardRef(() => TenantIncomesModule),
    TenantNotificationsModule,
  ],
  controllers: [TenantReportsController],
  providers: [
    TenantReportsService,
    MonthlyReportSchedulerService,
    MissingIncomeReminderSchedulerService,
  ],
})
export class TenantReportsModule {}
