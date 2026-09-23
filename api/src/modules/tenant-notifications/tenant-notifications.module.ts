import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { CommercialModule } from '../commercial/commercial.module';
import { AuthUser } from '../../auth/auth-user.entity';
import { DeviceBinding } from '../../auth/device-binding.entity';
import { OneSignalClient } from './onesignal.client';
import { TenantNotificationsController } from './tenant-notifications.controller';
import { TenantNotificationsService } from './tenant-notifications.service';

@Module({
  imports: [
    ConfigModule,
    TenancyModule,
    CommercialModule,
    TypeOrmModule.forFeature([AuthUser, DeviceBinding]),
  ],
  controllers: [TenantNotificationsController],
  providers: [TenantNotificationsService, OneSignalClient],
  exports: [TenantNotificationsService, OneSignalClient],
})
export class TenantNotificationsModule {}
