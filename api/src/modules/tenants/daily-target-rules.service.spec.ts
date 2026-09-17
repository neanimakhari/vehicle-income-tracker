import { DailyTargetRulesService } from './daily-target-rules.service';
import { DailyTargetRule } from './daily-target-rule.entity';

describe('DailyTargetRulesService.resolveForDate', () => {
  const service = new DailyTargetRulesService({} as never);

  function rule(partial: Partial<DailyTargetRule> & Pick<DailyTargetRule, 'ruleType' | 'scope'>): DailyTargetRule {
    return {
      id: partial.id ?? 'r1',
      tenantId: 'demo',
      scope: partial.scope,
      driverUserId: partial.driverUserId ?? null,
      ruleType: partial.ruleType,
      amount: partial.amount ?? null,
      weekdays: partial.weekdays ?? null,
      startDate: partial.startDate ?? null,
      endDate: partial.endDate ?? null,
      exactDate: partial.exactDate ?? null,
      priority: partial.priority ?? 0,
      isActive: partial.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it('returns closed with null amount when closed rule matches', () => {
    const rules = [
      rule({
        id: 'c1',
        scope: 'tenant',
        ruleType: 'closed',
        exactDate: '2026-12-25',
      }),
    ];
    const resolved = service.resolveForDate(rules, '2026-12-25', 'drv1', 1500, 1200);
    expect(resolved.closed).toBe(true);
    expect(resolved.amount).toBeNull();
    expect(resolved.source).toBe('closed');
  });

  it('prefers driver exact date over tenant weekday and flat defaults', () => {
    const rules = [
      rule({
        id: 'w1',
        scope: 'tenant',
        ruleType: 'weekday',
        amount: 1000,
        weekdays: [4], // Thursday
        priority: 1,
      }),
      rule({
        id: 'e1',
        scope: 'driver',
        driverUserId: 'drv1',
        ruleType: 'exact_date',
        amount: 2500,
        exactDate: '2026-09-17',
        priority: 0,
      }),
    ];
    // 2026-09-17 is a Thursday
    const resolved = service.resolveForDate(rules, '2026-09-17', 'drv1', 900, 800);
    expect(resolved.amount).toBe(2500);
    expect(resolved.source).toBe('exact_date');
  });

  it('falls back to flat driver then tenant defaults', () => {
    expect(
      service.resolveForDate([], '2026-09-17', 'drv1', 900, 800).amount,
    ).toBe(900);
    expect(
      service.resolveForDate([], '2026-09-17', 'drv1', null, 800).amount,
    ).toBe(800);
    expect(
      service.resolveForDate([], '2026-09-17', 'drv1', null, null).source,
    ).toBe('none');
  });
});
