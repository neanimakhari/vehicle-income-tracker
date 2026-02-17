import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TenantContextService } from '../tenant-context.service';
import { TenantsService } from '../../modules/tenants/tenants.service';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { tenantId?: string | null };
    const tenantFromContext = this.tenantContext.getTenantId();

    if (!tenantFromContext) {
      throw new ForbiddenException('Tenant context missing');
    }

    if (!user?.tenantId || user.tenantId !== tenantFromContext) {
      throw new ForbiddenException('Tenant access denied');
    }

    const tenantsService = this.moduleRef.get(TenantsService, { strict: false });
    if (!tenantsService) {
      throw new ForbiddenException('Tenant access denied');
    }
    const tenant = await tenantsService.findBySlug(tenantFromContext);
    if (tenant.enforceIpAllowlist && tenant.allowedIps?.length) {
      const ip = request.ip ?? request.connection?.remoteAddress;
      if (!ip || !tenant.allowedIps.includes(ip)) {
        throw new ForbiddenException('IP not allowed');
      }
    }

    return true;
  }
}



