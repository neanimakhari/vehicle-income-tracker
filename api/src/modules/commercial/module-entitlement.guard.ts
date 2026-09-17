import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { CommercialService } from './commercial.service';
import { REQUIRED_MODULE_KEY } from './requires-module.decorator';

@Injectable()
export class ModuleEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContextService,
    private readonly commercialService: CommercialService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!moduleKey) return true;

    const tenantSlug = this.tenantContext.getTenantId();
    if (!tenantSlug) {
      throw new ForbiddenException({
        message: 'Tenant context missing',
        code: 'FEATURE_NOT_ENTITLED',
      });
    }

    const allowed = await this.commercialService.hasModule(
      tenantSlug,
      moduleKey,
    );
    if (!allowed) {
      throw new ForbiddenException({
        message: `Module not entitled: ${moduleKey}`,
        code: 'FEATURE_NOT_ENTITLED',
        moduleKey,
      });
    }
    return true;
  }
}
