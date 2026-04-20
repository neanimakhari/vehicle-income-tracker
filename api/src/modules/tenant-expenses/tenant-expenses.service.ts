import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { TenantExpense } from './tenant-expense.entity';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { TenantIncome } from '../tenant-incomes/tenant-income.entity';

type CreateExpensePayload = {
  description: string;
  amount: number;
  receiptImage?: string | null;
  loggedOn: string;
};

type UpdateUnifiedExpensePayload = {
  description?: string;
  amount?: number;
  receiptImage?: string | null;
  loggedOn?: string;
};

export type UnifiedTenantExpense = {
  id: string;
  sourceType: 'manual' | 'income';
  sourceId: string;
  description: string;
  amount: number;
  receiptImage: string | null;
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

  private async hasReceiptImageColumn(): Promise<boolean> {
    const schemaName = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'expenses'
         AND column_name = 'receipt_image'
       LIMIT 1`,
      [schemaName],
    );
    return rows.length > 0;
  }

  private mapManualRow(row: Record<string, unknown>): TenantExpense {
    return {
      id: String(row.id),
      description: String(row.description ?? ''),
      amount: Number(row.amount ?? 0),
      receiptImage: row.receipt_image != null ? String(row.receipt_image) : null,
      loggedOn: row.logged_on instanceof Date ? row.logged_on : new Date(String(row.logged_on)),
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
    } as TenantExpense;
  }

  private async loadManualExpenses(): Promise<TenantExpense[]> {
    const schemaName = this.tenantScope.getTenantSchema();
    const hasReceipt = await this.hasReceiptImageColumn();
    const receiptSelect = hasReceipt ? `"receipt_image"` : `NULL AS "receipt_image"`;
    const rows = await this.dataSource.query(
      `SELECT "id", "description", "amount", ${receiptSelect}, "logged_on", "created_at", "updated_at"
       FROM "${schemaName}"."expenses"
       ORDER BY "logged_on" DESC`,
    );
    return rows.map((row: Record<string, unknown>) => this.mapManualRow(row));
  }

  private async loadManualExpenseById(id: string): Promise<TenantExpense | null> {
    const schemaName = this.tenantScope.getTenantSchema();
    const hasReceipt = await this.hasReceiptImageColumn();
    const receiptSelect = hasReceipt ? `"receipt_image"` : `NULL AS "receipt_image"`;
    const rows = await this.dataSource.query(
      `SELECT "id", "description", "amount", ${receiptSelect}, "logged_on", "created_at", "updated_at"
       FROM "${schemaName}"."expenses"
       WHERE "id" = $1
       LIMIT 1`,
      [id],
    );
    if (rows.length === 0) return null;
    return this.mapManualRow(rows[0] as Record<string, unknown>);
  }

  async findAll(): Promise<TenantExpense[]> {
    return this.loadManualExpenses();
  }

  private parseUnifiedId(id: string): { sourceType: 'manual' | 'income'; sourceId: string } {
    const [sourceType, ...rest] = id.split(':');
    const sourceId = rest.join(':').trim();
    if ((sourceType !== 'manual' && sourceType !== 'income') || !sourceId) {
      throw new NotFoundException('Expense not found');
    }
    return { sourceType, sourceId };
  }

  async findAllUnified(): Promise<UnifiedTenantExpense[]> {
    const expenseRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantExpense,
    );
    const incomeRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );

    return expenseRepo.withSchema(async () => {
      const manualExpenses = await this.loadManualExpenses();
      const incomeExpenses = await incomeRepo.withSchema(incomeRepository =>
        incomeRepository
          .createQueryBuilder('income')
          .where(
            '(income.expensePrice IS NOT NULL OR income.expenseDetail IS NOT NULL OR income.expenseImage IS NOT NULL)',
          )
          .orderBy('income.logged_on', 'DESC')
          .getMany(),
      );

      const manualRows: UnifiedTenantExpense[] = manualExpenses.map(expense => ({
        id: `manual:${expense.id}`,
        sourceType: 'manual',
        sourceId: expense.id,
        description: expense.description,
        amount: Number(expense.amount) || 0,
        receiptImage: expense.receiptImage ?? null,
        loggedOn: expense.loggedOn?.toISOString() ?? new Date(0).toISOString(),
      }));

      const incomeRows: UnifiedTenantExpense[] = incomeExpenses.map(income => ({
        id: `income:${income.id}`,
        sourceType: 'income',
        sourceId: income.id,
        description: income.expenseDetail ?? 'Expense (from income log)',
        amount: Number(income.expensePrice) || 0,
        receiptImage: income.expenseImage ?? null,
        loggedOn: income.loggedOn?.toISOString() ?? new Date(0).toISOString(),
      }));

      return [...manualRows, ...incomeRows].sort(
        (a, b) => new Date(b.loggedOn).getTime() - new Date(a.loggedOn).getTime(),
      );
    });
  }

  async findOne(id: string): Promise<TenantExpense> {
    const expense = await this.loadManualExpenseById(id);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async create(payload: CreateExpensePayload): Promise<TenantExpense> {
    const schemaName = this.tenantScope.getTenantSchema();
    const hasReceipt = await this.hasReceiptImageColumn();
    const columns = hasReceipt
      ? `"description", "amount", "receipt_image", "logged_on"`
      : `"description", "amount", "logged_on"`;
    const values = hasReceipt ? `$1, $2, $3, $4` : `$1, $2, $3`;
    const params = hasReceipt
      ? [payload.description, payload.amount, payload.receiptImage ?? null, new Date(payload.loggedOn)]
      : [payload.description, payload.amount, new Date(payload.loggedOn)];
    const rows = await this.dataSource.query(
      `INSERT INTO "${schemaName}"."expenses" (${columns})
       VALUES (${values})
       RETURNING "id", "description", "amount", ${hasReceipt ? `"receipt_image"` : `NULL AS "receipt_image"`}, "logged_on", "created_at", "updated_at"`,
      params,
    );
    const saved = this.mapManualRow(rows[0] as Record<string, unknown>);
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
  }

  async updateUnified(id: string, payload: UpdateUnifiedExpensePayload): Promise<UnifiedTenantExpense> {
    const { sourceType, sourceId } = this.parseUnifiedId(id);
    const expenseRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantExpense,
    );
    const incomeRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );

    if (sourceType === 'manual') {
      return expenseRepo.withSchema(async () => {
        const existing = await this.loadManualExpenseById(sourceId);
        if (!existing) throw new NotFoundException('Expense not found');
        const schemaName = this.tenantScope.getTenantSchema();
        const hasReceipt = await this.hasReceiptImageColumn();
        const setParts: string[] = [];
        const params: unknown[] = [];
        if (payload.description !== undefined) {
          params.push(payload.description);
          setParts.push(`"description" = $${params.length}`);
        }
        if (payload.amount !== undefined) {
          params.push(payload.amount);
          setParts.push(`"amount" = $${params.length}`);
        }
        if (payload.loggedOn !== undefined) {
          params.push(new Date(payload.loggedOn));
          setParts.push(`"logged_on" = $${params.length}`);
        }
        if (hasReceipt && payload.receiptImage !== undefined) {
          params.push(payload.receiptImage);
          setParts.push(`"receipt_image" = $${params.length}`);
        }
        if (setParts.length > 0) {
          params.push(sourceId);
          await this.dataSource.query(
            `UPDATE "${schemaName}"."expenses"
             SET ${setParts.join(', ')}
             WHERE "id" = $${params.length}`,
            params,
          );
        }
        const saved = await this.loadManualExpenseById(sourceId);
        if (!saved) throw new NotFoundException('Expense not found');
        await this.auditService.log({
          action: 'tenant.expense.unified.update',
          actorUserId: null,
          actorRole: 'TENANT_ADMIN',
          targetType: 'tenant_expense',
          targetId: saved.id,
          metadata: {
            tenant: this.tenantContext.getTenantId(),
            sourceType: 'manual',
            amount: saved.amount,
          },
        });
        return {
          id: `manual:${saved.id}`,
          sourceType: 'manual',
          sourceId,
          description: saved.description,
          amount: Number(saved.amount) || 0,
          receiptImage: saved.receiptImage ?? null,
          loggedOn: saved.loggedOn?.toISOString() ?? new Date(0).toISOString(),
        };
      });
    }

    return incomeRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id: sourceId } });
      if (!existing) throw new NotFoundException('Expense not found');
      if (payload.description !== undefined) existing.expenseDetail = payload.description || null;
      if (payload.amount !== undefined) existing.expensePrice = payload.amount;
      if (payload.receiptImage !== undefined) existing.expenseImage = payload.receiptImage;
      if (payload.loggedOn !== undefined) existing.loggedOn = new Date(payload.loggedOn);
      const saved = await repo.save(existing);
      await this.auditService.log({
        action: 'tenant.expense.unified.update',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_income_expense',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          sourceType: 'income',
          amount: saved.expensePrice,
        },
      });
      return {
        id: `income:${saved.id}`,
        sourceType: 'income',
        sourceId: saved.id,
        description: saved.expenseDetail ?? 'Expense (from income log)',
        amount: Number(saved.expensePrice) || 0,
        receiptImage: saved.expenseImage ?? null,
        loggedOn: saved.loggedOn?.toISOString() ?? new Date(0).toISOString(),
      };
    });
  }

  async remove(id: string) {
    const schemaName = this.tenantScope.getTenantSchema();
    const existing = await this.loadManualExpenseById(id);
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }
    await this.dataSource.query(
      `DELETE FROM "${schemaName}"."expenses" WHERE "id" = $1`,
      [id],
    );
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
  }

  async removeUnified(id: string) {
    const { sourceType, sourceId } = this.parseUnifiedId(id);
    if (sourceType === 'manual') {
      return this.remove(sourceId);
    }

    const incomeRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return incomeRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id: sourceId } });
      if (!existing) throw new NotFoundException('Expense not found');
      existing.expenseDetail = null;
      existing.expensePrice = null;
      existing.expenseImage = null;
      await repo.save(existing);
      await this.auditService.log({
        action: 'tenant.expense.unified.delete',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_income_expense',
        targetId: sourceId,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          sourceType: 'income',
          incomeId: sourceId,
        },
      });
      return { deleted: true };
    });
  }
}

