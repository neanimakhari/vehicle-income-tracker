import { Module } from '@nestjs/common';
import { TenantUsersController } from './tenant-users.controller';
import { TenantUsersService } from './tenant-users.service';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthService } from './tenant-auth.service';
import { TenantDevicesController } from './tenant-devices.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantUser } from './tenant-user.entity';
import { DriverDocument } from './driver-document.entity';
import { DriverExpiryUpdateRequest } from './driver-expiry-update-request.entity';
import { RefreshToken } from '../../auth/refresh-token.entity';
import { DeviceBinding } from '../../auth/device-binding.entity';
import { AuthModule } from '../../auth/auth.module';
import { DriverProfileController } from './driver-profile.controller';
import { DriverProfileService } from './driver-profile.service';
import { EmailModule } from '../email/email.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TenantsModule } from '../tenants/tenants.module';
import { TenantMobileAppController } from './tenant-mobile-app.controller';
import { PublicMobileAppController } from '../tenants/public-mobile-app.controller';
import { MobileAppDownloadService } from './mobile-app-download.service';

@Module({
  imports: [
    TenancyModule,
    TenantsModule,
    AuditModule,
    AuthModule,
    EmailModule,
    WebhooksModule,
    TypeOrmModule.forFeature([Tenant, TenantUser, DriverDocument, DriverExpiryUpdateRequest, RefreshToken, DeviceBinding]),
  ],
  controllers: [
    TenantUsersController,
    TenantAuthController,
    TenantDevicesController,
    DriverProfileController,
    TenantMobileAppController,
    PublicMobileAppController,
  ],
  providers: [
    TenantUsersService,
    TenantAuthService,
    DriverProfileService,
    MobileAppDownloadService,
  ],
  exports: [DriverProfileService, MobileAppDownloadService],
})
export class TenantUsersModule {}

