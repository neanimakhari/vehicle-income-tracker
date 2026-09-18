import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DailyTargetRule,
  DailyTargetRuleScope,
  DailyTargetRuleType,
} from './daily-target-rule.entity';

export type ResolvedDailyTarget = {
  amount: number | null;
  closed: boolean;
  source:
    | 'closed'
    | 'exact_date'
    | 'date_range'
    | 'weekday'
    | 'driver_flat'
    | 'tenant_flat'
    | 'none';
  ruleId?: string;
};

type CreateRuleInput = {
  scope: DailyTargetRuleScope;
  driverUserId?: string | null;
  ruleType: DailyTargetRuleType;
  amount?: number | null;
  weekdays?: number[] | null;
  startDate?: string | null;
  endDate?: string | null;
  exactDate?: string | null;
  priority?: number;
  isActive?: boolean;
};

@Injectable()
export class DailyTargetRulesService {
  constructor(
    @InjectRepository(DailyTargetRule)
    private readonly rulesRepo: Repository<DailyTargetRule>,
  ) {}

  async listForTenant(
    tenantSlug: string,
    driverUserId?: string | null,
  ): Promise<DailyTargetRule[]> {
    const qb = this.rulesRepo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantSlug', { tenantSlug })
      .orderBy('r.priority', 'DESC')
      .addOrderBy('r.created_at', 'ASC');
    if (driverUserId) {
      qb.andWhere(
        '(r.scope = :tenantScope OR (r.scope = :driverScope AND r.driver_user_id = :driverUserId))',
        {
          tenantScope: 'tenant',
          driverScope: 'driver',
          driverUserId,
        },
      );
    }
    return qb.getMany();
  }

  async create(
    tenantSlug: string,
    input: CreateRuleInput,
  ): Promise<DailyTargetRule> {
    this.validateInput(input);
    const row = this.rulesRepo.create({
      tenantId: tenantSlug,
      scope: input.scope,
      driverUserId: input.scope === 'driver' ? input.driverUserId! : null,
      ruleType: input.ruleType,
      amount: input.ruleType === 'closed' ? null : input.amount ?? null,
      weekdays: input.ruleType === 'weekday' ? input.weekdays ?? [] : null,
      startDate: input.ruleType === 'date_range' ? input.startDate ?? null : null,
      endDate: input.ruleType === 'date_range' ? input.endDate ?? null : null,
      exactDate:
        input.ruleType === 'exact_date' ||
        (input.ruleType === 'closed' && input.exactDate)
          ? input.exactDate ?? null
          : input.ruleType === 'closed'
            ? input.exactDate ?? null
            : null,
      priority: input.priority ?? 0,
      isActive: input.isActive ?? true,
    });
    // Closed can be exact_date or date_range style
    if (input.ruleType === 'closed') {
      row.exactDate = input.exactDate ?? null;
      row.startDate = input.startDate ?? null;
      row.endDate = input.endDate ?? null;
      row.weekdays = input.weekdays ?? null;
    }
    return this.rulesRepo.save(row);
  }

  async update(
    tenantSlug: string,
    id: string,
    input: Partial<CreateRuleInput>,
  ): Promise<DailyTargetRule> {
    const row = await this.rulesRepo.findOne({
      where: { id, tenantId: tenantSlug },
    });
    if (!row) throw new NotFoundException('Target rule not found');

    const merged: CreateRuleInput = {
      scope: input.scope ?? row.scope,
      driverUserId:
        input.driverUserId !== undefined
          ? input.driverUserId
          : row.driverUserId,
      ruleType: input.ruleType ?? row.ruleType,
      amount: input.amount !== undefined ? input.amount : row.amount,
      weekdays: input.weekdays !== undefined ? input.weekdays : row.weekdays,
      startDate: input.startDate !== undefined ? input.startDate : row.startDate,
      endDate: input.endDate !== undefined ? input.endDate : row.endDate,
      exactDate: input.exactDate !== undefined ? input.exactDate : row.exactDate,
      priority: input.priority !== undefined ? input.priority : row.priority,
      isActive: input.isActive !== undefined ? input.isActive : row.isActive,
    };
    this.validateInput(merged);

    row.scope = merged.scope;
    row.driverUserId = merged.scope === 'driver' ? merged.driverUserId! : null;
    row.ruleType = merged.ruleType;
    row.amount = merged.ruleType === 'closed' ? null : merged.amount ?? null;
    row.weekdays =
      merged.ruleType === 'weekday' ||
      (merged.ruleType === 'closed' && merged.weekdays?.length)
        ? merged.weekdays ?? null
        : merged.ruleType === 'closed'
          ? merged.weekdays ?? null
          : null;
    row.startDate =
      merged.ruleType === 'date_range' || merged.ruleType === 'closed'
        ? merged.startDate ?? null
        : null;
    row.endDate =
      merged.ruleType === 'date_range' || merged.ruleType === 'closed'
        ? merged.endDate ?? null
        : null;
    row.exactDate =
      merged.ruleType === 'exact_date' || merged.ruleType === 'closed'
        ? merged.exactDate ?? null
        : null;
    row.priority = merged.priority ?? 0;
    row.isActive = merged.isActive ?? true;
    return this.rulesRepo.save(row);
  }

  async remove(tenantSlug: string, id: string): Promise<{ deleted: true }> {
    const row = await this.rulesRepo.findOne({
      where: { id, tenantId: tenantSlug },
    });
    if (!row) throw new NotFoundException('Target rule not found');
    await this.rulesRepo.remove(row);
    return { deleted: true };
  }

  /**
   * Resolve effective daily target for a driver on YYYY-MM-DD.
   * Closed → amount null + closed true (no enforcement).
   */
  resolveForDate(
    rules: DailyTargetRule[],
    dateStr: string,
    driverUserId: string,
    personalFlat: number | null,
    tenantFlat: number | null,
  ): ResolvedDailyTarget {
    const active = rules.filter((r) => r.isActive);
    const weekday = this.weekdayOf(dateStr);

    const matchesDate = (r: DailyTargetRule): boolean => {
      if (r.exactDate && r.exactDate === dateStr) return true;
      if (r.startDate && r.endDate) {
        return dateStr >= r.startDate && dateStr <= r.endDate;
      }
      if (r.weekdays?.length) {
        return r.weekdays.includes(weekday);
      }
      // closed with only exact or range/weekdays already covered
      if (r.ruleType === 'closed' && r.exactDate) return r.exactDate === dateStr;
      if (r.ruleType === 'closed' && r.startDate && r.endDate) {
        return dateStr >= r.startDate && dateStr <= r.endDate;
      }
      if (r.ruleType === 'closed' && r.weekdays?.length) {
        return r.weekdays.includes(weekday);
      }
      if (r.ruleType === 'weekday' && r.weekdays?.length) {
        return r.weekdays.includes(weekday);
      }
      if (r.ruleType === 'exact_date' && r.exactDate === dateStr) return true;
      if (
        r.ruleType === 'date_range' &&
        r.startDate &&
        r.endDate &&
        dateStr >= r.startDate &&
        dateStr <= r.endDate
      ) {
        return true;
      }
      return false;
    };

    const sortByPriority = (a: DailyTargetRule, b: DailyTargetRule) =>
      (b.priority ?? 0) - (a.priority ?? 0);

    const driverRules = active
      .filter((r) => r.scope === 'driver' && r.driverUserId === driverUserId)
      .sort(sortByPriority);
    const tenantRules = active
      .filter((r) => r.scope === 'tenant')
      .sort(sortByPriority);

    const closedDriver = driverRules.find(
      (r) => r.ruleType === 'closed' && matchesDate(r),
    );
    if (closedDriver) {
      return { amount: null, closed: true, source: 'closed', ruleId: closedDriver.id };
    }
    const closedTenant = tenantRules.find(
      (r) => r.ruleType === 'closed' && matchesDate(r),
    );
    if (closedTenant) {
      return { amount: null, closed: true, source: 'closed', ruleId: closedTenant.id };
    }

    const pickAmount = (
      list: DailyTargetRule[],
      type: DailyTargetRuleType,
      source: ResolvedDailyTarget['source'],
    ): ResolvedDailyTarget | null => {
      const hit = list.find((r) => r.ruleType === type && matchesDate(r));
      if (!hit || hit.amount == null) return null;
      return {
        amount: Number(hit.amount),
        closed: false,
        source,
        ruleId: hit.id,
      };
    };

    for (const type of ['exact_date', 'date_range', 'weekday'] as const) {
      const fromDriver = pickAmount(driverRules, type, type);
      if (fromDriver) return fromDriver;
      const fromTenant = pickAmount(tenantRules, type, type);
      if (fromTenant) return fromTenant;
    }

    if (personalFlat != null) {
      return { amount: personalFlat, closed: false, source: 'driver_flat' };
    }
    if (tenantFlat != null) {
      return { amount: tenantFlat, closed: false, source: 'tenant_flat' };
    }
    return { amount: null, closed: false, source: 'none' };
  }

  private weekdayOf(dateStr: string): number {
    // Parse as UTC noon to avoid TZ edge on date-only strings
    const d = new Date(`${dateStr}T12:00:00Z`);
    return d.getUTCDay();
  }

  private validateInput(input: CreateRuleInput) {
    if (input.scope === 'driver' && !input.driverUserId) {
      throw new BadRequestException('driverUserId is required for driver scope');
    }
    if (input.ruleType === 'weekday') {
      if (!input.weekdays?.length) {
        throw new BadRequestException('weekdays required for weekday rules');
      }
      if (input.amount == null || Number(input.amount) < 0) {
        throw new BadRequestException('amount required for weekday rules');
      }
    }
    if (input.ruleType === 'date_range') {
      if (!input.startDate || !input.endDate) {
        throw new BadRequestException(
          'startDate and endDate required for date_range rules',
        );
      }
      if (input.amount == null || Number(input.amount) < 0) {
        throw new BadRequestException('amount required for date_range rules');
      }
    }
    if (input.ruleType === 'exact_date') {
      if (!input.exactDate) {
        throw new BadRequestException('exactDate required for exact_date rules');
      }
      if (input.amount == null || Number(input.amount) < 0) {
        throw new BadRequestException('amount required for exact_date rules');
      }
    }
    if (input.ruleType === 'closed') {
      const hasExact = Boolean(input.exactDate);
      const hasRange = Boolean(input.startDate && input.endDate);
      const hasWeekdays = Boolean(input.weekdays?.length);
      if (!hasExact && !hasRange && !hasWeekdays) {
        throw new BadRequestException(
          'closed rules need exactDate, date range, or weekdays',
        );
      }
    }
  }
}
