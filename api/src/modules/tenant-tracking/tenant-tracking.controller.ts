import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  Allow,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { ModuleEntitlementGuard } from '../commercial/module-entitlement.guard';
import { RequiresModule } from '../commercial/requires-module.decorator';
import { TenantTrackingService } from './tenant-tracking.service';
import { TrackingAnalyticsService } from './tracking-analytics.service';
import { TrackingEventsService } from './tracking-events.service';
import {
  johannesburgToday,
} from './tracking-analytics.formulas';

class SimulateDto {
  @IsUUID()
  vehicleId: string;

  @IsIn(['basic', 'obd'])
  profile: 'basic' | 'obd';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  points?: number;
}

class BindImeiDto {
  @IsString()
  @IsNotEmpty()
  imei: string;
}

class DeviceActiveDto {
  @IsBoolean()
  isActive: boolean;
}

class DeviceCommandDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @Allow()
  value?: number | boolean | string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxSpeedKph?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  reportIntervalSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  heartbeatIntervalSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  overspeedDurationSec?: number;
}

class RecalculateDto {
  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsBoolean()
  includeSimulate?: boolean;
}

@Controller('tenant/tracking')
@ApiTags('tenant-tracking')
@RequiresModule('tracking_live')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  TenantContextGuard,
  TenantAccessGuard,
  ModuleEntitlementGuard,
)
export class TenantTrackingController {
  constructor(
    private readonly tracking: TenantTrackingService,
    private readonly trackingAnalytics: TrackingAnalyticsService,
    private readonly trackingEvents: TrackingEventsService,
  ) {}

  @Get('latest')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async latest(@Req() req: { user?: { sub?: string; role?: string } }) {
    await this.tracking.recordLiveMapView({
      userId: req.user?.sub ?? null,
      role: req.user?.role ?? null,
    });
    return this.tracking.latest();
  }

  @Get('events')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  listEvents(@Query('limit') limit?: string) {
    return this.trackingEvents.listRecent(
      limit ? Number(limit) : 50,
    );
  }

  @Get('trips-report')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  tripsReport(
    @Query('day') day?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.trackingEvents.tripsAndParkingReport({ day, vehicleId });
  }

  @Get('history')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  history(
    @Query('limit') limit?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tracking.history({
      limit: limit ? Number(limit) : undefined,
      vehicleId,
      from,
      to,
    });
  }

  @Get('metrics/summary')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  metrics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.tracking.metricsSummary({ from, to, vehicleId });
  }

  @Get('analytics')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  listAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.trackingAnalytics.listAnalytics({ from, to, vehicleId });
  }

  @Get('reconciliation')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  listReconciliation(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.trackingAnalytics.listReconciliation({ from, to, vehicleId });
  }

  @Post('analytics/recalculate')
  @Roles('TENANT_ADMIN')
  async recalculate(@Body() dto: RecalculateDto) {
    const day = dto.day ?? johannesburgToday();
    if (dto.vehicleId) {
      return this.trackingAnalytics.recomputeVehicleDay({
        day,
        vehicleId: dto.vehicleId,
        includeSimulate: dto.includeSimulate,
      });
    }
    return this.trackingAnalytics.recomputeDayForTenant(day, {
      includeSimulate: dto.includeSimulate,
    });
  }

  @Post('simulate')
  @Roles('TENANT_ADMIN')
  simulate(@Body() dto: SimulateDto) {
    // Opt-in only — production must not expose demo trails.
    if (process.env.TRACKING_SIMULATE_ENABLED !== 'true') {
      throw new ForbiddenException({
        message: 'Tracking simulation is disabled',
        code: 'TRACKING_SIMULATE_DISABLED',
      });
    }
    return this.tracking.simulate(dto);
  }

  @Get('devices')
  @Roles('TENANT_ADMIN')
  listDevices() {
    return this.tracking.listDevices();
  }

  @Post('devices/:vehicleId/bind')
  @Roles('TENANT_ADMIN')
  bind(@Param('vehicleId') vehicleId: string, @Body() dto: BindImeiDto) {
    return this.tracking.bindImei(vehicleId, dto.imei);
  }

  @Post('devices/:vehicleId/unbind')
  @Roles('TENANT_ADMIN')
  unbind(@Param('vehicleId') vehicleId: string) {
    return this.tracking.unbindImei(vehicleId);
  }

  @Patch('devices/:imei/active')
  @Roles('TENANT_ADMIN')
  setActive(@Param('imei') imei: string, @Body() dto: DeviceActiveDto) {
    return this.tracking.setDeviceActive(imei, dto.isActive);
  }

  @Post('devices/:imei/command')
  @Roles('TENANT_ADMIN')
  sendCommand(
    @Param('imei') imei: string,
    @Body() dto: DeviceCommandDto,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.tracking.sendDeviceCommand(imei, dto as Record<string, unknown>, {
      sub: req.user?.sub,
      role: req.user?.role,
    });
  }
}
