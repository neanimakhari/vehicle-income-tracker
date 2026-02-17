import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('tenant/audit')
@ApiTags('tenant-audit')
export class TenantAuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  findTenantAudit() {
    const tenantId = this.tenantContext.getTenantId();
    return this.auditService.findByTenant(tenantId ?? '');
  }
}

