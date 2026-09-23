import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthUser } from '../auth/auth-user.entity';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformBootstrapController } from './platform-bootstrap.controller';
import { PlatformBootstrapService } from './platform-bootstrap.service';
import { PlatformSystemController } from './platform-system.controller';
import { SysAccountsController } from './sys-accounts.controller';
import { SysAccountsService } from './sys-accounts.service';
import { PlatformOpsService } from './platform-ops.service';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../modules/audit/audit.module';
import { TenantsModule } from '../modules/tenants/tenants.module';
import { PlatformSettingsModule } from '../modules/platform-settings/platform-settings.module';
import { CommercialModule } from '../modules/commercial/commercial.module';
import { TenantAdminModule } from '../tenant-admin/tenant-admin.module';
import { EmailModule } from '../modules/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthUser]),
    ConfigModule,
    AuditModule,
    TenantsModule,
    PlatformSettingsModule,
    CommercialModule,
    TenantAdminModule,
    EmailModule,
  ],
  controllers: [
    PlatformAdminController,
    PlatformBootstrapController,
    PlatformSystemController,
    SysAccountsController,
  ],
  providers: [
    PlatformAdminService,
    PlatformBootstrapService,
    SysAccountsService,
    PlatformOpsService,
  ],
})
export class PlatformAdminModule {}
