import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { EmailModule } from '../email/email.module';
import { TenantsModule } from '../tenants/tenants.module';
import { GpsTrackingPoint } from './gps-tracking-point.entity';
import { TrackerDevice } from './tracker-device.entity';
import { TenantTrackingController } from './tenant-tracking.controller';
import { TrackingIngestController } from './tracking-ingest.controller';
import { TenantTrackingService } from './tenant-tracking.service';
import { TrackingGateway } from './tracking.gateway';
import { TrackingAnalyticsService } from './tracking-analytics.service';
import { TrackingAnalyticsScheduler } from './tracking-analytics.scheduler';
import { GeofenceService } from './geofence.service';
import { GeofenceScheduler } from './geofence.scheduler';
import {
  GeofenceAlertController,
  GeofenceController,
} from './geofence.controller';
import { TrackingEventsService } from './tracking-events.service';
import { TrackingOfflineScheduler } from './tracking-offline.scheduler';

@Module({
  imports: [
    TenancyModule,
    AuditModule,
    CommercialModule,
    EmailModule,
    TenantsModule,
    TypeOrmModule.forFeature([GpsTrackingPoint, TrackerDevice]),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret') ?? process.env.JWT_SECRET,
      }),
    }),
  ],
  controllers: [
    TenantTrackingController,
    TrackingIngestController,
    GeofenceController,
    GeofenceAlertController,
  ],
  providers: [
    TenantTrackingService,
    TrackingGateway,
    TrackingAnalyticsService,
    TrackingAnalyticsScheduler,
    GeofenceService,
    GeofenceScheduler,
    TrackingEventsService,
    TrackingOfflineScheduler,
  ],
  exports: [
    TenantTrackingService,
    TrackingAnalyticsService,
    GeofenceService,
    TrackingEventsService,
  ],
})
export class TenantTrackingModule {}
