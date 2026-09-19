import {
  Body,
  Controller,
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
  constructor(private readonly tracking: TenantTrackingService) {}

  @Get('latest')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async latest(@Req() req: { user?: { sub?: string; role?: string } }) {
    await this.tracking.recordLiveMapView({
      userId: req.user?.sub ?? null,
      role: req.user?.role ?? null,
    });
    return this.tracking.latest();
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

  @Post('simulate')
  @Roles('TENANT_ADMIN')
  simulate(@Body() dto: SimulateDto) {
    if (process.env.TRACKING_SIMULATE_ENABLED === 'false') {
      return { disabled: true };
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
}
