import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

/** Shared platform hosts — never treat as tenant slugs (e.g. vit-api.vehinc.co.za). */
const RESERVED_SUBDOMAINS = new Set([
  'localhost',
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'vit-api',
  'vit-admin',
  'vit-platform',
  'vit-app',
  'vit-database',
]);

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const headerTenantId = req.header('x-tenant-id')?.trim() || null;
    const host = req.hostname ?? '';
    const subdomain = (host.split('.')[0] ?? '').toLowerCase();
    const fromHost =
      subdomain && !RESERVED_SUBDOMAINS.has(subdomain) ? subdomain : null;
    const tenantId = headerTenantId || fromHost;

    this.tenantContext.run(tenantId, () => next());
  }
}



