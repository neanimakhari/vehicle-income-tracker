import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { TenantExpensesController } from './tenant-expenses.controller';
import { TenantExpensesService } from './tenant-expenses.service';
import { TenantExpense } from './tenant-expense.entity';

@Module({
  imports: [TenancyModule, AuditModule, TypeOrmModule.forFeature([TenantExpense])],
  controllers: [TenantExpensesController],
  providers: [TenantExpensesService],
})
export class TenantExpensesModule {}



