import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../modules/audit/audit.service';
import { TenantsService } from '../modules/tenants/tenants.service';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

const FAILED_LOGIN_SPIKE_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const TENANT_LIMIT_THRESHOLD = 0.9; // alert when usage >= 90% of limit

export type PlatformDefaultPolicyHints = {
  recommendMfa: boolean;
  recommendDriverMfa: boolean;
  recommendBiometrics: boolean;
};

export type PlatformDefaultsDto = {
  defaultPolicyHints: PlatformDefaultPolicyHints;
  defaultLimits: { maxDrivers: number | null; maxStorageMb: number | null };
};

export type AlertItem = {
  type: 'new_tenant' | 'tenant_updated' | 'failed_login_spike' | 'tenant_near_limit';
  at: string;
  message: string;
  metadata?: Record<string, unknown>;
};

@Controller('platform')
@ApiTags('platform-system')
export class PlatformSystemController {
  constructor(
    private readonly auditService: AuditService,
    private readonly tenantsService: TenantsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('defaults')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  getDefaults(): PlatformDefaultsDto {
    const recommendMfa =
      this.configService.get<string>('platform.defaults.recommendMfa') !== 'false';
    const recommendDriverMfa =
      this.configService.get<string>('platform.defaults.recommendDriverMfa') !== 'false';
    const recommendBiometrics =
      this.configService.get<string>('platform.defaults.recommendBiometrics') === 'true';
    return {
      defaultPolicyHints: {
        recommendMfa: !!recommendMfa,
        recommendDriverMfa: !!recommendDriverMfa,
        recommendBiometrics: !!recommendBiometrics,
      },
      defaultLimits: {
        maxDrivers: this.configService.get<number>('platform.defaults.maxDrivers') ?? null,
        maxStorageMb: this.configService.get<number>('platform.defaults.maxStorageMb') ?? null,
      },
    };
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  async getAlerts(): Promise<{ alerts: AlertItem[] }> {
    const alerts: AlertItem[] = [];
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);

    // New tenant & tenant updated (last 7 days)
    const tenantLogs = await this.auditService.findRecentByActions(
      ['tenant.create', 'tenant.update'],
      since7d,
      100,
    );
    for (const log of tenantLogs) {
      if (log.action === 'tenant.create') {
        const slug = (log.metadata as { slug?: string })?.slug ?? log.targetId ?? '—';
        const name = (log.metadata as { name?: string })?.name ?? slug;
        alerts.push({
          type: 'new_tenant',
          at: log.createdAt.toISOString(),
          message: `New tenant created: ${name} (${slug})`,
          metadata: log.metadata as Record<string, unknown>,
        });
      } else if (log.action === 'tenant.update') {
        const slug = (log.metadata as { slug?: string })?.slug ?? '—';
        alerts.push({
          type: 'tenant_updated',
          at: log.createdAt.toISOString(),
          message: `Tenant updated: ${slug}`,
          metadata: log.metadata as Record<string, unknown>,
        });
      }
    }

    // Failed login spike (platform + tenant, last 24h)
    const failedLogins = await this.auditService.findRecentByActions(
      ['auth.login_failed', 'tenant.auth.login_failed'],
      since24h,
      500,
    );
    if (failedLogins.length >= FAILED_LOGIN_SPIKE_THRESHOLD) {
      const byTenant: Record<string, number> = {};
      for (const log of failedLogins) {
        const tenant = (log.metadata as { tenant?: string })?.tenant ?? (log.action === 'auth.login_failed' ? 'platform' : '—');
        byTenant[tenant] = (byTenant[tenant] ?? 0) + 1;
      }
      const top = Object.entries(byTenant).sort((a, b) => b[1] - a[1])[0];
      alerts.push({
        type: 'failed_login_spike',
        at: new Date().toISOString(),
        message: `Failed login spike: ${failedLogins.length} failures in last 24h${top ? ` (${top[0]}: ${top[1]})` : ''}`,
        metadata: { count: failedLogins.length, byTenant },
      });
    }

    // Tenant approaching limits (maxDrivers set and usage >= 90%)
    const usageList = await this.tenantsService.getUsageForAll();
    const tenants = await this.tenantsService.findAll();
    const usageBySlug = new Map(usageList.map((u) => [u.slug, u]));
    for (const t of tenants) {
      if (t.maxDrivers == null || t.maxDrivers < 1) continue;
      const u = usageBySlug.get(t.slug);
      if (!u) continue;
      const pct = u.drivers / t.maxDrivers;
      if (pct >= TENANT_LIMIT_THRESHOLD) {
        alerts.push({
          type: 'tenant_near_limit',
          at: new Date().toISOString(),
          message: `Tenant approaching limit: ${t.name} (${t.slug}) — ${u.drivers}/${t.maxDrivers} drivers (${Math.round(pct * 100)}%)`,
          metadata: { tenantId: t.id, slug: t.slug, drivers: u.drivers, maxDrivers: t.maxDrivers },
        });
      }
    }

    alerts.sort((a, b) => (b.at > a.at ? 1 : -1));
    return { alerts: alerts.slice(0, 50) };
  }
}
