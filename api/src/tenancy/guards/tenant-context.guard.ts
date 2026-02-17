import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { TenantScopeService } from '../tenant-scope.service';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenantScope: TenantScopeService) {}

  canActivate(_context: ExecutionContext): boolean {
    try {
      const schema = this.tenantScope.getTenantSchema();
      if (!schema) {
        throw new BadRequestException('Tenant context is required');
      }
      return true;
    } catch (error) {
      console.error('TenantContextGuard error:', error);
      throw new BadRequestException('Invalid tenant context');
    }
  }
}



