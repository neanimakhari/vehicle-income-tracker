import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantScopeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  getTenantSchema(): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('Tenant context missing');
    }
    return `tenant_${tenantId.replace(/-/g, '_')}`;
  }
}



