import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { TenantExpense } from './tenant-expense.entity';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';

type CreateExpensePayload = {
  description: string;
  amount: number;
  receiptImage?: string | null;
  loggedOn: string;
};

@Injectable()
export class TenantExpensesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(): Promise<TenantExpense[]> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantExpense,
    );
    return tenantRepo.withSchema(repo => repo.find());
  }

  async findOne(id: string): Promise<TenantExpense> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantExpense,
    );
    return tenantRepo.withSchema(async repo => {
      const expense = await repo.findOne({ where: { id } });
      if (!expense) {
        throw new NotFoundException('Expense not found');
      }
      return expense;
    });
  }

  async create(payload: CreateExpensePayload): Promise<TenantExpense> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantExpense,
    );
    return tenantRepo.withSchema(async repo => {
      const expense = repo.create({
        description: payload.description,
        amount: payload.amount,
        receiptImage: payload.receiptImage ?? null,
        loggedOn: new Date(payload.loggedOn),
      });
      const saved = await repo.save(expense);
      await this.auditService.log({
        action: 'tenant.expense.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_expense',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          amount: saved.amount,
        },
      });
      return saved;
    });
  }

  async remove(id: string) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantExpense,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Expense not found');
      }
      await repo.remove(existing);
      await this.auditService.log({
        action: 'tenant.expense.delete',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_expense',
        targetId: id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          description: existing.description,
          amount: existing.amount,
        },
      });
      return { deleted: true };
    });
  }
}

