import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantsController } from './tenants.controller';
import { TenantPolicyController } from './tenant-policy.controller';
import { TenantsService } from './tenants.service';
import { TenantSchemasService } from './tenants.schemas.service';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { TenancyModule } from '../../tenancy/tenancy.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AuditModule, EmailModule, forwardRef(() => TenancyModule)],
  controllers: [TenantsController, TenantPolicyController],
  providers: [TenantsService, TenantSchemasService],
  exports: [TenantsService, TenantSchemasService],
})
export class TenantsModule {}

