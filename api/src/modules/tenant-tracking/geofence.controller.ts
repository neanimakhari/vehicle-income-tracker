import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { ModuleEntitlementGuard } from '../commercial/module-entitlement.guard';
import { RequiresModule } from '../commercial/requires-module.decorator';
import { TenantReportRecipientsService } from '../tenants/tenant-report-recipients.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { GeofenceService } from './geofence.service';
import { johannesburgToday } from './tracking-analytics.formulas';

class LatLngDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

class CreateGeofenceDto {
  @IsString()
  name: string;

  @IsIn(['rank', 'depot', 'fuel', 'forbidden', 'custom', 'corridor'])
  type: string;

  @IsOptional()
  @IsObject()
  geojson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  path?: LatLngDto[];

  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsNumber()
  radiusM?: number;

  @IsOptional()
  @IsNumber()
  bufferM?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class UpdateGeofenceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['rank', 'depot', 'fuel', 'forbidden', 'custom', 'corridor'])
  type?: string;

  @IsOptional()
  @IsObject()
  geojson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  path?: LatLngDto[];

  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsNumber()
  radiusM?: number;

  @IsOptional()
  @IsNumber()
  bufferM?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class AssignmentDto {
  @IsUUID()
  geofenceId: string;

  @IsString()
  role: string;

  @IsOptional()
  @IsBoolean()
  isRequiredCorridor?: boolean;
}

class SetAssignmentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentDto)
  assignments: AssignmentDto[];
}

class RouteTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  path: LatLngDto[];

  @IsOptional()
  @IsNumber()
  bufferM?: number;

  @IsOptional()
  @IsString()
  color?: string;
}

class FenceTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['polygon', 'corridor', 'circle'])
  kind?: string;

  @IsOptional()
  @IsIn(['rank', 'depot', 'fuel', 'forbidden', 'custom', 'corridor'])
  defaultFenceType?: string;

  @IsOptional()
  @IsObject()
  geojson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  path?: LatLngDto[];

  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsNumber()
  radiusM?: number;

  @IsOptional()
  @IsNumber()
  bufferM?: number;

  @IsOptional()
  @IsString()
  color?: string;
}

class InstantiateTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['rank', 'depot', 'fuel', 'forbidden', 'custom', 'corridor'])
  type?: string;

  @IsOptional()
  @IsNumber()
  offsetLat?: number;

  @IsOptional()
  @IsNumber()
  offsetLng?: number;

  @IsOptional()
  @IsNumber()
  bufferM?: number;

  @IsOptional()
  @IsString()
  color?: string;
}

class AlertRuleDto {
  @IsString()
  name: string;

  @IsIn([
    'enter_forbidden',
    'exit_home_after_hours',
    'off_corridor_minutes',
    'rank_dwell_minutes',
    'enter_rank',
    'overspeed',
    'engine_start',
    'engine_stop',
    'power_loss',
    'low_voltage',
    'offline',
  ])
  trigger: string;

  @IsOptional()
  @IsNumber()
  thresholdMinutes?: number;

  @IsOptional()
  @IsArray()
  channels?: string[];

  @IsOptional()
  @IsNumber()
  cooldownMinutes?: number;
}

class SettingsDto {
  @IsOptional()
  @IsString()
  workWindowStart?: string;

  @IsOptional()
  @IsString()
  workWindowEnd?: string;

  @IsOptional()
  @IsNumber()
  defaultCorridorBufferM?: number;

  @IsOptional()
  @IsNumber()
  geofenceHysteresisSamples?: number;

  @IsOptional()
  @IsNumber()
  overspeedKph?: number;

  @IsOptional()
  @IsNumber()
  lowVoltageThreshold?: number;

  @IsOptional()
  @IsNumber()
  offlineMinutes?: number;

  @IsOptional()
  @IsNumber()
  idleAlertMinutes?: number;

  @IsOptional()
  @IsString()
  quietHoursStart?: string | null;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string | null;
}

class RecalcDto {
  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}

@Controller('tenant/tracking/geofences')
@ApiTags('tenant-tracking-geofences')
@RequiresModule('tracking_geofence')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  TenantContextGuard,
  TenantAccessGuard,
  ModuleEntitlementGuard,
)
export class GeofenceController {
  constructor(private readonly geofences: GeofenceService) {}

  @Get()
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  list() {
    return this.geofences.listGeofences();
  }

  @Get('export')
  @Roles('TENANT_ADMIN')
  export() {
    return this.geofences.exportGeoJson();
  }

  @Post('import')
  @Roles('TENANT_ADMIN')
  import(@Body() body: { type: string; features: unknown[] }) {
    return this.geofences.importGeoJson(body as never);
  }

  @Get('events')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  events(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.geofences.listEvents({
      from,
      to,
      vehicleId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('daily')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  daily(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.geofences.listDaily({ from, to, vehicleId });
  }

  @Get('settings')
  @Roles('TENANT_ADMIN')
  settings() {
    return this.geofences.getSettings();
  }

  @Patch('settings')
  @Roles('TENANT_ADMIN')
  patchSettings(@Body() dto: SettingsDto) {
    return this.geofences.updateSettings(dto);
  }

  @Post('recalculate')
  @Roles('TENANT_ADMIN')
  async recalculate(@Body() dto: RecalcDto) {
    const day = dto.day ?? johannesburgToday();
    if (dto.vehicleId) {
      return this.geofences.recomputeVehicleDay(day, dto.vehicleId);
    }
    return this.geofences.recomputeDay(day);
  }

  @Get('routes')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  routes() {
    return this.geofences.listRouteTemplates();
  }

  @Post('routes')
  @Roles('TENANT_ADMIN')
  createRoute(@Body() dto: RouteTemplateDto) {
    return this.geofences.createRouteTemplate(dto);
  }

  @Get('templates')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  listTemplates() {
    return this.geofences.listFenceTemplates();
  }

  @Post('templates')
  @Roles('TENANT_ADMIN')
  createTemplate(@Body() dto: FenceTemplateDto) {
    return this.geofences.createFenceTemplate(dto as never);
  }

  @Post('templates/:id/instantiate')
  @Roles('TENANT_ADMIN')
  instantiateTemplate(
    @Param('id') id: string,
    @Body() dto: InstantiateTemplateDto,
  ) {
    return this.geofences.instantiateFenceTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Roles('TENANT_ADMIN')
  deleteTemplate(@Param('id') id: string) {
    return this.geofences.deleteFenceTemplate(id);
  }

  @Get('vehicles/:vehicleId')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  vehicleAssignments(@Param('vehicleId') vehicleId: string) {
    return this.geofences.getVehicleAssignments(vehicleId);
  }

  @Put('vehicles/:vehicleId')
  @Roles('TENANT_ADMIN')
  setAssignments(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: SetAssignmentsDto,
  ) {
    return this.geofences.setVehicleAssignments(vehicleId, dto.assignments);
  }

  @Get(':id')
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  get(@Param('id') id: string) {
    return this.geofences.getGeofence(id);
  }

  @Post()
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateGeofenceDto) {
    return this.geofences.createGeofence(dto as never);
  }

  @Patch(':id')
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateGeofenceDto) {
    return this.geofences.updateGeofence(id, dto as never);
  }

  @Delete(':id')
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string) {
    return this.geofences.deleteGeofence(id);
  }
}

@Controller('tenant/tracking/alert-rules')
@ApiTags('tenant-tracking-alerts')
@RequiresModule('tracking_alerts')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  TenantContextGuard,
  TenantAccessGuard,
  ModuleEntitlementGuard,
)
export class GeofenceAlertController {
  constructor(private readonly geofences: GeofenceService) {}

  @Get()
  @Roles('TENANT_ADMIN')
  list() {
    return this.geofences.listAlertRules();
  }

  @Get('fires/recent')
  @Roles('TENANT_ADMIN')
  fires(@Query('limit') limit?: string) {
    return this.geofences.listAlertFires(limit ? Number(limit) : 50);
  }

  @Post()
  @Roles('TENANT_ADMIN')
  create(@Body() dto: AlertRuleDto) {
    return this.geofences.createAlertRule(dto);
  }

  @Patch(':id')
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: Partial<AlertRuleDto> & { isActive?: boolean }) {
    return this.geofences.updateAlertRule(id, dto);
  }

  @Delete(':id')
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string) {
    return this.geofences.deleteAlertRule(id);
  }
}

class AlertRecipientDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateAlertRecipientDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('tenant/tracking/alert-recipients')
@ApiTags('tenant-tracking-alerts')
@RequiresModule('tracking_alerts')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  TenantContextGuard,
  TenantAccessGuard,
  ModuleEntitlementGuard,
)
export class AlertRecipientsController {
  constructor(
    private readonly recipients: TenantReportRecipientsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private slug() {
    const slug = this.tenantContext.getTenantId();
    if (!slug) throw new Error('Tenant context missing');
    return slug;
  }

  @Get()
  @Roles('TENANT_ADMIN')
  list() {
    return this.recipients.listByTenantSlug(this.slug());
  }

  @Post()
  @Roles('TENANT_ADMIN')
  create(@Body() dto: AlertRecipientDto) {
    return this.recipients.create(this.slug(), dto);
  }

  @Patch(':id')
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateAlertRecipientDto) {
    return this.recipients.update(this.slug(), id, dto);
  }

  @Delete(':id')
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string) {
    return this.recipients.remove(this.slug(), id);
  }
}
