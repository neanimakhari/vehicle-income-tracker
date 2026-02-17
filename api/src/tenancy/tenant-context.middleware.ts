import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const headerTenantId = req.header('x-tenant-id') ?? null;
    const host = req.hostname ?? '';
    const subdomain = host.split('.')[0] ?? null;
    const tenantId = headerTenantId || (subdomain && subdomain !== 'localhost' ? subdomain : null);

    this.tenantContext.run(tenantId, () => next());
  }
}



