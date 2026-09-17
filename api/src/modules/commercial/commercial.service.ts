import { Injectable, NotFoundException } from '@nestjs/common';
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

  async listPlans() {
    const plans = await this.plansRepo.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
    const links = await this.planModulesRepo.find();
    const byPlan = new Map<string, string[]>();
    for (const link of links) {
      const arr = byPlan.get(link.planId) ?? [];
      arr.push(link.moduleKey);
      byPlan.set(link.planId, arr);
    }
    return plans.map((p) => ({
      ...p,
      moduleKeys: byPlan.get(p.id) ?? [],
    }));
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
    return entitlements.includes(moduleKey);
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
      row.moduleOverrides = data.moduleOverrides;
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
    return this.listPlans().then((plans) =>
      plans.find((p) => p.id === planId),
    );
  }
}
