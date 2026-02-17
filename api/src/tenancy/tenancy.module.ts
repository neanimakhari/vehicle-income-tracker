import { Module, forwardRef } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantScopeService } from './tenant-scope.service';
import { TenantContextGuard } from './guards/tenant-context.guard';
import { TenantAccessGuard } from './guards/tenant-access.guard';
import { TenantsModule } from '../modules/tenants/tenants.module';

@Module({
  imports: [forwardRef(() => TenantsModule)],
  providers: [
    TenantContextService,
    TenantContextMiddleware,
    TenantScopeService,
    TenantContextGuard,
    TenantAccessGuard,
  ],
  exports: [
    TenantContextService,
    TenantScopeService,
    TenantContextGuard,
    TenantAccessGuard,
  ],
})
export class TenancyModule {}

