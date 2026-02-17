import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser } from '../auth/auth-user.entity';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformBootstrapController } from './platform-bootstrap.controller';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { PlatformSystemController } from './platform-system.controller';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../modules/audit/audit.module';
import { TenantsModule } from '../modules/tenants/tenants.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuthUser]), ConfigModule, AuditModule, TenantsModule],
  controllers: [
    PlatformAdminController,
    PlatformBootstrapController,
    PlatformSystemController,
  ],
  providers: [PlatformAdminService, PlatformBootstrapService],
})
export class PlatformAdminModule {}

