import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser } from '../auth/auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantAdminService } from './tenant-admin.service';
import { AuditModule } from '../modules/audit/audit.module';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuthUser, Tenant]), AuditModule, EmailModule],
  controllers: [TenantAdminController],
  providers: [TenantAdminService],
})
export class TenantAdminModule {}

