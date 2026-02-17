import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantsService } from './tenants.service';

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
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
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
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
    };
  }
}

