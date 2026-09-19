import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { GpsTrackingPoint } from './gps-tracking-point.entity';
import { TrackerDevice } from './tracker-device.entity';
import { TenantTrackingController } from './tenant-tracking.controller';
import { TrackingIngestController } from './tracking-ingest.controller';
import { TenantTrackingService } from './tenant-tracking.service';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [
    TenancyModule,
    AuditModule,
    CommercialModule,
    TypeOrmModule.forFeature([GpsTrackingPoint, TrackerDevice]),
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret') ?? process.env.JWT_SECRET,
      }),
    }),
  ],
  controllers: [TenantTrackingController, TrackingIngestController],
  providers: [TenantTrackingService, TrackingGateway],
  exports: [TenantTrackingService],
})
export class TenantTrackingModule {}
