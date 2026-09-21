import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenantTrackingService } from './tenant-tracking.service';

class IngestPointDto {
  @IsString()
  @IsNotEmpty()
  imei: string;

  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  speedKph?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsBoolean()
  ignitionOn?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  engineRpm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fuelRateLph?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fuelLevelPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  externalVoltage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  backupBatteryLevel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  coolantC?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  odometerKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  engineLoadPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  satellites?: number;

  @IsOptional()
  @IsBoolean()
  gpsFixOk?: boolean;

  @IsOptional()
  @IsBoolean()
  overspeed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  alarmFlags?: number;

  @IsOptional()
  @IsString()
  alarmExt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gsmSignal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  msgId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  canOdometerKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  canSpeedKph?: number;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  rawPayload?: string;
}

/** Internal ingest for gps-ingest sidecar (shared secret). */
@Controller('internal/tracking')
@ApiTags('internal-tracking')
export class TrackingIngestController {
  constructor(private readonly tracking: TenantTrackingService) {}

  @Post('ingest')
  ingest(
    @Headers('x-ingest-secret') secret: string | undefined,
    @Body() dto: IngestPointDto,
  ) {
    const expected =
      process.env.GPS_INGEST_SECRET ?? process.env.TRACKING_INGEST_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid ingest secret');
    }
    const recordedAt =
      dto.recordedAt != null && dto.recordedAt !== ''
        ? new Date(dto.recordedAt)
        : undefined;
    return this.tracking.ingestByImei(dto.imei, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      speedKph: dto.speedKph,
      heading: dto.heading,
      ignitionOn: dto.ignitionOn,
      engineRpm: dto.engineRpm,
      fuelRateLph: dto.fuelRateLph,
      fuelLevelPercent: dto.fuelLevelPercent,
      externalVoltage: dto.externalVoltage,
      backupBatteryLevel: dto.backupBatteryLevel,
      coolantC: dto.coolantC,
      odometerKm: dto.odometerKm,
      engineLoadPercent: dto.engineLoadPercent,
      satellites: dto.satellites,
      overspeed: dto.overspeed,
      alarmFlags: dto.alarmFlags,
      alarmExt: dto.alarmExt,
      gsmSignal: dto.gsmSignal,
      msgId: dto.msgId,
      canOdometerKm: dto.canOdometerKm,
      canSpeedKph: dto.canSpeedKph,
      source: dto.source ?? 'obd',
      rawPayload: dto.rawPayload,
      gpsFixOk: dto.gpsFixOk ?? true,
      recordedAt:
        recordedAt && !Number.isNaN(recordedAt.getTime())
          ? recordedAt
          : undefined,
    });
  }
}
