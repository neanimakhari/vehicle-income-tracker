import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantsService } from './tenants.service';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

class UpdateTenantReminderPolicyDto {
  @IsBoolean()
  @IsOptional()
  missingIncomeReminderEnabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  missingIncomeCutoffHour?: number;

  @IsString()
  @IsOptional()
  missingIncomeTimezone?: string;

  @IsBoolean()
  @IsOptional()
  missingIncomeEscalationEnabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  missingIncomeEscalationHour?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultDailyTargetAmount?: number | null;
}

@Controller('tenant/policy')
@ApiTags('tenant-policy')
export class TenantPolicyController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async getPolicy() {
    const slug = this.tenantContext.getTenantId();
    if (!slug) {
      return { requireMfa: false, requireMfaUsers: false };
    }
    const tenant = await this.tenantsService.findBySlug(slug);
    return {
      requireMfa: tenant.requireMfa,
      requireMfaUsers: tenant.requireMfaUsers,
      requireBiometrics: tenant.requireBiometrics,
      sessionTimeoutMinutes: tenant.sessionTimeoutMinutes,
      enforceIpAllowlist: tenant.enforceIpAllowlist,
      enforceDeviceAllowlist: tenant.enforceDeviceAllowlist,
      featureFlags: tenant.featureFlags ?? [],
      missingIncomeReminderEnabled: tenant.missingIncomeReminderEnabled,
      missingIncomeCutoffHour: tenant.missingIncomeCutoffHour,
      missingIncomeTimezone: tenant.missingIncomeTimezone,
      missingIncomeEscalationEnabled: tenant.missingIncomeEscalationEnabled,
      missingIncomeEscalationHour: tenant.missingIncomeEscalationHour,
      defaultDailyTargetAmount: tenant.defaultDailyTargetAmount != null
        ? Number(tenant.defaultDailyTargetAmount)
        : null,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
    };
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  async updatePolicy(@Body() dto: UpdateTenantReminderPolicyDto) {
    const slug = this.tenantContext.getTenantId();
    if (!slug) {
      return { updated: false };
    }
    const tenant = await this.tenantsService.findBySlug(slug);
    const updated = await this.tenantsService.update(tenant.id, dto);
    return {
      updated: true,
      missingIncomeReminderEnabled: updated.missingIncomeReminderEnabled,
      missingIncomeCutoffHour: updated.missingIncomeCutoffHour,
      missingIncomeTimezone: updated.missingIncomeTimezone,
      missingIncomeEscalationEnabled: updated.missingIncomeEscalationEnabled,
      missingIncomeEscalationHour: updated.missingIncomeEscalationHour,
      defaultDailyTargetAmount: updated.defaultDailyTargetAmount != null
        ? Number(updated.defaultDailyTargetAmount)
        : null,
    };
  }

  @Get('public')
  @UseGuards(TenantContextGuard)
  async getPublicPolicy() {
    const slug = this.tenantContext.getTenantId();
    if (!slug) {
      return { requireMfa: false, requireMfaUsers: false };
    }
    const tenant = await this.tenantsService.findBySlug(slug);
    return {
      requireMfa: tenant.requireMfa,
      requireMfaUsers: tenant.requireMfaUsers,
      requireBiometrics: tenant.requireBiometrics,
      sessionTimeoutMinutes: tenant.sessionTimeoutMinutes,
      enforceIpAllowlist: tenant.enforceIpAllowlist,
      enforceDeviceAllowlist: tenant.enforceDeviceAllowlist,
      featureFlags: tenant.featureFlags ?? [],
      missingIncomeReminderEnabled: tenant.missingIncomeReminderEnabled,
      missingIncomeCutoffHour: tenant.missingIncomeCutoffHour,
      missingIncomeTimezone: tenant.missingIncomeTimezone,
      missingIncomeEscalationEnabled: tenant.missingIncomeEscalationEnabled,
      missingIncomeEscalationHour: tenant.missingIncomeEscalationHour,
      defaultDailyTargetAmount: tenant.defaultDailyTargetAmount != null
        ? Number(tenant.defaultDailyTargetAmount)
        : null,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
    };
  }
}
