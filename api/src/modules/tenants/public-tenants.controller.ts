import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';

@Controller('public/tenants')
@ApiTags('public-tenants')
export class PublicTenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async listActive(): Promise<Array<{ slug: string; name: string }>> {
    return this.tenantsService.findAllPublic();
  }
}

