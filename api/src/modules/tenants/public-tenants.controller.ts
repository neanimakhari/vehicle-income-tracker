import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';

/**
 * @deprecated Prefer email-first login. Kept temporarily so older mobile APKs
 * that still open a tenant picker can function until min-app-version cuts them off.
 * Do not use from new tenant-admin or Flutter clients.
 */
@Controller('public/tenants')
@ApiTags('public-tenants')
export class PublicTenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async listActive(): Promise<Array<{ slug: string; name: string }>> {
    return this.tenantsService.findAllPublic();
  }
}

