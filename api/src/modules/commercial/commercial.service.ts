import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FeatureModuleEntity } from './feature-module.entity';
import { PlanEntity } from './plan.entity';
import { PlanModuleEntity } from './plan-module.entity';
import { TenantEntitlementEntity } from './tenant-entitlement.entity';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class CommercialService {
  constructor(
    @InjectRepository(FeatureModuleEntity)
    private readonly modulesRepo: Repository<FeatureModuleEntity>,
    @InjectRepository(PlanEntity)
    private readonly plansRepo: Repository<PlanEntity>,
    @InjectRepository(PlanModuleEntity)
    private readonly planModulesRepo: Repository<PlanModuleEntity>,
    @InjectRepository(TenantEntitlementEntity)
    private readonly entitlementsRepo: Repository<TenantEntitlementEntity>,
    private readonly tenantsService: TenantsService,
  ) {}

  listModules() {
    return this.modulesRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async listPlans(includeInactive = false) {
    const plans = await this.plansRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { code: 'ASC' },
    });
    const links = await this.planModulesRepo.find();
    const byPlan = new Map<string, string[]>();
    for (const link of links) {
      const arr = byPlan.get(link.planId) ?? [];
      arr.push(link.moduleKey);
      byPlan.set(link.planId, arr);
    }
    const entitlementCounts = await this.entitlementsRepo
      .createQueryBuilder('e')
      .select('e.plan_id', 'planId')
      .addSelect('COUNT(*)', 'cnt')
      .where('e.plan_id IS NOT NULL')
      .groupBy('e.plan_id')
      .getRawMany<{ planId: string; cnt: string }>();
    const countByPlan = new Map(
      entitlementCounts.map((r) => [r.planId, Number(r.cnt)]),
    );
    return plans.map((p) => ({
      ...p,
      moduleKeys: byPlan.get(p.id) ?? [],
      tenantCount: countByPlan.get(p.id) ?? 0,
    }));
  }

  async createPlan(data: {
    code: string;
    name: string;
    description?: string | null;
    maxDriversDefault?: number | null;
    maxStorageMbDefault?: number | null;
    isActive?: boolean;
    moduleKeys?: string[];
  }) {
    const code = data.code.trim().toLowerCase();
    const existing = await this.plansRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException('Plan code already exists');
    }
    const plan = await this.plansRepo.save(
      this.plansRepo.create({
        code,
        name: data.name.trim(),
        description: data.description ?? null,
        maxDriversDefault: data.maxDriversDefault ?? null,
        maxStorageMbDefault: data.maxStorageMbDefault ?? null,
        isActive: data.isActive ?? true,
      }),
    );
    if (data.moduleKeys?.length) {
      await this.updatePlanModules(plan.id, data.moduleKeys);
    }
    const plans = await this.listPlans(true);
    return plans.find((p) => p.id === plan.id);
  }

  async updatePlan(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      maxDriversDefault?: number | null;
      maxStorageMbDefault?: number | null;
      isActive?: boolean;
      moduleKeys?: string[];
    },
  ) {
    const plan = await this.plansRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (data.name !== undefined) plan.name = data.name.trim();
    if (data.description !== undefined) plan.description = data.description;
    if (data.maxDriversDefault !== undefined)
      plan.maxDriversDefault = data.maxDriversDefault;
    if (data.maxStorageMbDefault !== undefined)
      plan.maxStorageMbDefault = data.maxStorageMbDefault;
    if (data.isActive !== undefined) plan.isActive = data.isActive;
    await this.plansRepo.save(plan);
    if (data.moduleKeys !== undefined) {
      await this.updatePlanModules(id, data.moduleKeys);
    }
    const plans = await this.listPlans(true);
    return plans.find((p) => p.id === id);
  }

  async getTenantEntitlement(tenantSlug: string) {
    await this.tenantsService.findBySlug(tenantSlug);
    const row = await this.entitlementsRepo.findOne({
      where: { tenantId: tenantSlug },
    });
    const entitlements = await this.resolveEntitlements(tenantSlug);
    return {
      tenantId: tenantSlug,
      planId: row?.planId ?? null,
      moduleOverrides: row?.moduleOverrides ?? {},
      trialEndsAt: row?.trialEndsAt ?? null,
      notes: row?.notes ?? null,
      entitlements,
      legacyUnrestricted: !row,
    };
  }

  /** Lightweight plan badges for the tenants table. */
  async listTenantEntitlementSummaries(): Promise<
    Array<{
      tenantId: string;
      planId: string | null;
      planCode: string | null;
      planName: string | null;
      moduleCount: number;
      legacyUnrestricted: boolean;
    }>
  > {
    const tenants = await this.tenantsService.findAll();
    const plans = await this.listPlans(true);
    const planById = new Map(plans.map((p) => [p.id, p]));
    const rows = await this.entitlementsRepo.find();
    const rowBySlug = new Map(rows.map((r) => [r.tenantId, r]));
    const allModuleCount = (await this.modulesRepo.count({ where: { isActive: true } }));

    return Promise.all(
      tenants.map(async (t) => {
        const row = rowBySlug.get(t.slug);
        if (!row) {
          return {
            tenantId: t.slug,
            planId: null,
            planCode: null,
            planName: null,
            moduleCount: allModuleCount,
            legacyUnrestricted: true,
          };
        }
        const plan = row.planId ? planById.get(row.planId) : null;
        const entitlements = await this.resolveEntitlements(t.slug);
        return {
          tenantId: t.slug,
          planId: row.planId,
          planCode: plan?.code ?? null,
          planName: plan?.name ?? null,
          moduleCount: entitlements.length,
          legacyUnrestricted: false,
        };
      }),
    );
  }

  /**
   * No entitlement row => all active modules (legacy tenants).
   * With plan => plan modules, then apply overrides true/false.
   */
  async resolveEntitlements(tenantSlug: string): Promise<string[]> {
    const allModules = await this.modulesRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    const allKeys = allModules.map((m) => m.key);
    const row = await this.entitlementsRepo.findOne({
      where: { tenantId: tenantSlug },
    });
    if (!row) {
      return allKeys;
    }

    let keys = new Set<string>();
    if (row.planId) {
      const links = await this.planModulesRepo.find({
        where: { planId: row.planId },
      });
      keys = new Set(links.map((l) => l.moduleKey));
    }

    const overrides = row.moduleOverrides ?? {};
    for (const [key, enabled] of Object.entries(overrides)) {
      if (enabled) keys.add(key);
      else keys.delete(key);
    }

    if (row.trialEndsAt && row.trialEndsAt.getTime() < Date.now()) {
      // expired trial: keep only explicitly overridden true modules + plan still applies
      // (plan remains; trial expiry is informational unless we strip — keep plan modules)
    }

    return allKeys.filter((k) => keys.has(k));
  }

  async hasModule(tenantSlug: string, moduleKey: string): Promise<boolean> {
    const entitlements = await this.resolveEntitlements(tenantSlug);
    if (!entitlements.includes(moduleKey)) return false;
    // Submodules require parent entitled as well
    const mod = await this.modulesRepo.findOne({ where: { key: moduleKey } });
    if (mod?.parentKey && !entitlements.includes(mod.parentKey)) {
      return false;
    }
    return true;
  }

  async upsertTenantEntitlement(
    tenantSlug: string,
    data: {
      planId?: string | null;
      moduleOverrides?: Record<string, boolean>;
      trialEndsAt?: string | null;
      notes?: string | null;
      syncLimitsFromPlan?: boolean;
    },
  ) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    let row = await this.entitlementsRepo.findOne({
      where: { tenantId: tenantSlug },
    });
    if (!row) {
      row = this.entitlementsRepo.create({
        tenantId: tenantSlug,
        planId: null,
        moduleOverrides: {},
      });
    }

    if (data.planId !== undefined) {
      if (data.planId) {
        const plan = await this.plansRepo.findOne({
          where: { id: data.planId },
        });
        if (!plan) throw new NotFoundException('Plan not found');
        row.planId = plan.id;
        if (data.syncLimitsFromPlan !== false) {
          await this.tenantsService.update(tenant.id, {
            maxDrivers: plan.maxDriversDefault,
            maxStorageMb: plan.maxStorageMbDefault,
          });
        }
      } else {
        row.planId = null;
      }
    }
    if (data.moduleOverrides !== undefined) {
      const overrides = { ...data.moduleOverrides };
      // Enabling a submodule forces parent on
      const allMods = await this.modulesRepo.find();
      const byKey = new Map(allMods.map((m) => [m.key, m]));
      for (const [key, enabled] of Object.entries(overrides)) {
        if (!enabled) continue;
        const parent = byKey.get(key)?.parentKey;
        if (parent && overrides[parent] !== false) {
          overrides[parent] = true;
        }
      }
      row.moduleOverrides = overrides;
    }
    if (data.trialEndsAt !== undefined) {
      row.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
    }
    if (data.notes !== undefined) {
      row.notes = data.notes;
    }

    const saved = await this.entitlementsRepo.save(row);
    const entitlements = await this.resolveEntitlements(tenantSlug);

    // Mirror into feature_flags cache for older readers
    await this.tenantsService.update(tenant.id, {
      featureFlags: entitlements,
    });

    return {
      ...saved,
      entitlements,
    };
  }

  async updatePlanModules(planId: string, moduleKeys: string[]) {
    const plan = await this.plansRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const valid = await this.modulesRepo.find({
      where: { key: In(moduleKeys), isActive: true },
    });
    const validKeys = new Set(valid.map((m) => m.key));
    await this.planModulesRepo.delete({ planId });
    const rows = [...validKeys].map((moduleKey) =>
      this.planModulesRepo.create({ planId, moduleKey }),
    );
    if (rows.length) await this.planModulesRepo.save(rows);
    return this.listPlans(true).then((plans) =>
      plans.find((p) => p.id === planId),
    );
  }
}
