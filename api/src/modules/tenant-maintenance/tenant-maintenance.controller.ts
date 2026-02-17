import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsInt, Min, IsEnum, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantMaintenanceService } from './tenant-maintenance.service';
import { ApiTags } from '@nestjs/swagger';
import { MaintenanceType } from './tenant-maintenance.entity';

class CreateMaintenanceDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string | null;

  @IsString()
  @IsNotEmpty()
  vehicleLabel: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string | null;

  @IsOptional()
  @IsEnum(MaintenanceType)
  maintenanceType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueKm?: number | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastServiceKm?: number | null;

  @IsOptional()
  @IsString()
  lastServiceDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceIntervalKm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceIntervalDays?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

class UpdateMaintenanceDto {
  @IsOptional()
  @IsEnum(MaintenanceType)
  maintenanceType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueKm?: number | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastServiceKm?: number | null;

  @IsOptional()
  @IsString()
  lastServiceDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceIntervalKm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceIntervalDays?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  isCompleted?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  completedKm?: number | null;
}

@Controller('tenant/maintenance')
@ApiTags('tenant-maintenance')
export class TenantMaintenanceController {
  constructor(private readonly tenantMaintenanceService: TenantMaintenanceService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  findAll() {
    return this.tenantMaintenanceService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateMaintenanceDto) {
    return this.tenantMaintenanceService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.tenantMaintenanceService.update(id, dto);
  }
}

