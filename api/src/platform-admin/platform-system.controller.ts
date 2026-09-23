import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../modules/audit/audit.service';
import { TenantsService } from '../modules/tenants/tenants.service';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlatformSettingsService } from '../modules/platform-settings/platform-settings.service';
import { CommercialService } from '../modules/commercial/commercial.service';
import { TenantAdminService } from '../tenant-admin/tenant-admin.service';
import { PlatformOpsService } from './platform-ops.service';
import { OpsAlertStore } from './ops-alert-store';

const FAILED_LOGIN_SPIKE_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 24 * 60 * 60 * 1000;
const TENANT_LIMIT_THRESHOLD = 0.9;
const HOST_MEM_ALERT_PCT = 85;
const HOST_DISK_ALERT_PCT = 85;

export type PlatformDefaultPolicyHints = {
  recommendMfa: boolean;
  recommendDriverMfa: boolean;
  recommendBiometrics: boolean;
};

export type PlatformDefaultsDto = {
  applyScope: 'new_tenants_only';
  defaultPolicyHints: PlatformDefaultPolicyHints;
  defaultLimits: { maxDrivers: number | null; maxStorageMb: number | null };
  defaultPlanCode: string | null;
};

export type AlertItem = {
  type:
    | 'new_tenant'
    | 'tenant_updated'
    | 'failed_login_spike'
    | 'tenant_near_limit'
    | 'ops_5xx'
    | 'host_memory'
    | 'host_disk';
  at: string;
  message: string;
  metadata?: Record<string, unknown>;
};

class PatchDefaultsDto {
  @IsBoolean() @IsOptional() recommendMfa?: boolean;
  @IsBoolean() @IsOptional() recommendDriverMfa?: boolean;
  @IsBoolean() @IsOptional() recommendBiometrics?: boolean;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) maxDrivers?: number | null;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) maxStorageMb?: number | null;
  @IsString() @IsOptional() defaultPlanCode?: string | null;
}

class PatchAnnouncementDto {
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsIn(['info', 'maintenance']) @IsOptional() severity?: 'info' | 'maintenance';
  @IsString() @IsOptional() message?: string;
  @IsString() @IsOptional() startsAt?: string | null;
  @IsString() @IsOptional() endsAt?: string | null;
  @IsBoolean() @IsOptional() blockWrites?: boolean;
}

class CreateFromTemplateDto {
  @IsString() name: string;
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/) slug: string;
  @IsString() @IsOptional() planCode?: string | null;
  @IsString() @IsOptional() contactName?: string | null;
  @IsEmail() @IsOptional() contactEmail?: string | null;
  @IsString() @IsOptional() contactPhone?: string | null;
  @IsString() @IsOptional() adminEmail?: string;
  @IsString() @IsOptional() @MinLength(8) adminPassword?: string;
  @IsString() @IsOptional() adminFirstName?: string;
  @IsString() @IsOptional() adminLastName?: string;
}

class MailTestDto {
  @IsEmail() to: string;
}

@Controller('platform')
@ApiTags('platform-system')
export class PlatformSystemController {
  constructor(
    private readonly auditService: AuditService,
    private readonly tenantsService: TenantsService,
    private readonly settings: PlatformSettingsService,
    private readonly commercial: CommercialService,
    private readonly tenantAdmins: TenantAdminService,
    private readonly ops: PlatformOpsService,
  ) {}

  @Get('defaults')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  async getDefaults(): Promise<PlatformDefaultsDto> {
    const d = await this.settings.getNewTenantDefaults();
    return {
      applyScope: 'new_tenants_only',
      defaultPolicyHints: {
        recommendMfa: d.recommendMfa,
        recommendDriverMfa: d.recommendDriverMfa,
        recommendBiometrics: d.recommendBiometrics,
      },
      defaultLimits: {
        maxDrivers: d.maxDrivers,
        maxStorageMb: d.maxStorageMb,
      },
      defaultPlanCode: d.defaultPlanCode,
    };
  }

  @Patch('defaults')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  async patchDefaults(
    @Body() dto: PatchDefaultsDto,
    @Req() req: { user?: { sub?: string } },
  ): Promise<PlatformDefaultsDto> {
    const d = await this.settings.updateNewTenantDefaults(
      {
        recommendMfa: dto.recommendMfa,
        recommendDriverMfa: dto.recommendDriverMfa,
        recommendBiometrics: dto.recommendBiometrics,
        maxDrivers: dto.maxDrivers,
        maxStorageMb: dto.maxStorageMb,
        defaultPlanCode: dto.defaultPlanCode,
      },
      req.user?.sub ?? null,
    );
    await this.auditService.log({
      action: 'platform.defaults.update',
      actorUserId: req.user?.sub ?? null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'platform_settings',
      targetId: 'new_tenant_defaults',
      metadata: { applyScope: 'new_tenants_only', ...d },
    });
    return {
      applyScope: 'new_tenants_only',
      defaultPolicyHints: {
        recommendMfa: d.recommendMfa,
        recommendDriverMfa: d.recommendDriverMfa,
        recommendBiometrics: d.recommendBiometrics,
      },
      defaultLimits: {
        maxDrivers: d.maxDrivers,
        maxStorageMb: d.maxStorageMb,
      },
      defaultPlanCode: d.defaultPlanCode,
    };
  }

  @Get('announcement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  getAnnouncement() {
    return this.settings.getAnnouncement();
  }

  @Patch('announcement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  async patchAnnouncement(
    @Body() dto: PatchAnnouncementDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    const next = await this.settings.updateAnnouncement(dto, req.user?.sub ?? null);
    await this.auditService.log({
      action: 'platform.announcement.update',
      actorUserId: req.user?.sub ?? null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'platform_settings',
      targetId: 'announcement',
      metadata: { ...next },
    });
    return next;
  }

  /** Public active banner for tenant-admin / mobile (no auth). */
  @Get('announcement/active')
  getActiveAnnouncement() {
    return this.settings.getActiveAnnouncement().then((a) => a ?? { enabled: false });
  }

  @Post('tenants/from-template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  async createFromTemplate(
    @Body() dto: CreateFromTemplateDto,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    const defaults = await this.settings.getNewTenantDefaults();
    const tenant = await this.tenantsService.create(
      {
        name: dto.name,
        slug: dto.slug,
        contactName: dto.contactName ?? null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        address: null,
        registrationNumber: null,
        taxId: null,
        website: null,
        notes: null,
      },
      { userId: req.user?.sub, role: req.user?.role },
    );

    await this.tenantsService.update(tenant.id, {
      requireMfa: defaults.recommendMfa,
      requireMfaUsers: defaults.recommendDriverMfa,
      requireBiometrics: defaults.recommendBiometrics,
      maxDrivers: defaults.maxDrivers,
      maxStorageMb: defaults.maxStorageMb,
    });

    const planCode = (dto.planCode ?? defaults.defaultPlanCode)?.trim() || null;
    let planId: string | null = null;
    if (planCode) {
      const plans = await this.commercial.listPlans(true);
      const plan = plans.find((p) => p.code === planCode && p.isActive);
      if (plan) {
        planId = plan.id;
        await this.commercial.upsertTenantEntitlement(tenant.slug, {
          planId: plan.id,
          syncLimitsFromPlan: true,
        });
      }
    }

    let admin: { id: string; email: string } | null = null;
    if (dto.adminEmail && dto.adminPassword) {
      const created = await this.tenantAdmins.create(
        dto.adminEmail,
        dto.adminPassword,
        tenant.slug,
      );
      admin = { id: created.id, email: created.email };
    }

    await this.auditService.log({
      action: 'tenant.create_from_template',
      actorUserId: req.user?.sub ?? null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: tenant.id,
      metadata: {
        slug: tenant.slug,
        planCode,
        planId,
        adminCreated: Boolean(admin),
      },
    });

    return {
      tenant: await this.tenantsService.findBySlug(tenant.slug),
      planId,
      planCode,
      admin,
      appliedDefaults: defaults,
    };
  }

  @Get('ops/host')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  getHostMetrics() {
    return this.ops.getHostMetrics();
  }

  @Get('ops/mail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  getMailStatus() {
    return this.ops.getMailStatus();
  }

  @Post('ops/mail-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  sendMailTest(@Body() dto: MailTestDto) {
    return this.ops.sendMailTest(dto.to);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  async getAlerts(): Promise<{ alerts: AlertItem[] }> {
    const alerts: AlertItem[] = [];
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);

    const tenantLogs = await this.auditService.findRecentByActions(
      ['tenant.create', 'tenant.update', 'tenant.create_from_template'],
      since7d,
      100,
    );
    for (const log of tenantLogs) {
      if (log.action === 'tenant.create' || log.action === 'tenant.create_from_template') {
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

    const failedLogins = await this.auditService.findRecentByActions(
      ['auth.login_failed', 'tenant.auth.login_failed'],
      since24h,
      500,
    );
    if (failedLogins.length >= FAILED_LOGIN_SPIKE_THRESHOLD) {
      alerts.push({
        type: 'failed_login_spike',
        at: new Date().toISOString(),
        message: `${failedLogins.length} failed login attempts in the last 24h`,
        metadata: { count: failedLogins.length },
      });
    }

    try {
      const usage = await this.tenantsService.getUsageForAll();
      for (const u of usage) {
        const tenant = await this.tenantsService.findBySlug(u.slug).catch(() => null);
        const max = tenant?.maxDrivers;
        if (max != null && max > 0 && u.drivers / max >= TENANT_LIMIT_THRESHOLD) {
          alerts.push({
            type: 'tenant_near_limit',
            at: new Date().toISOString(),
            message: `${u.name} near driver limit (${u.drivers}/${max})`,
            metadata: { slug: u.slug, drivers: u.drivers, maxDrivers: max },
          });
        }
      }
    } catch {
      // ignore usage errors
    }

    for (const ops of OpsAlertStore.list(25)) {
      alerts.push({
        type: 'ops_5xx',
        at: ops.at,
        message: ops.message,
        metadata: ops.metadata,
      });
    }

    try {
      const host = await this.ops.getHostMetrics();
      if (host.memory.hostUsedPercent >= HOST_MEM_ALERT_PCT) {
        alerts.push({
          type: 'host_memory',
          at: host.collectedAt,
          message: `Host memory at ${host.memory.hostUsedPercent}% (${host.memory.hostFreeMb} MB free of ${host.memory.hostTotalMb} MB)`,
          metadata: { ...host.memory },
        });
      }
      if (host.disk.root && host.disk.root.usedPercent >= HOST_DISK_ALERT_PCT) {
        alerts.push({
          type: 'host_disk',
          at: host.collectedAt,
          message: `Root disk at ${host.disk.root.usedPercent}% (${host.disk.root.freeMb} MB free of ${host.disk.root.totalMb} MB)`,
          metadata: { ...host.disk.root },
        });
      }
    } catch {
      // ignore host probe errors in alerts
    }

    alerts.sort((a, b) => b.at.localeCompare(a.at));
    return { alerts };
  }
}
