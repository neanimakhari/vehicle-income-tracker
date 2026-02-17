import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantVehicle } from './tenant-vehicle.entity';
import { TenantVehiclesService } from './tenant-vehicles.service';
import { ApiTags } from '@nestjs/swagger';

class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @IsOptional()
  @IsString()
  make?: string | null;

  @IsOptional()
  @IsString()
  model?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  vin?: string | null;

  @IsOptional()
  @IsString()
  engineNumber?: string | null;

  @IsOptional()
  @IsString()
  licenseDiskNumber?: string | null;

  @IsOptional()
  licenseDiskExpiry?: string | null;

  @IsOptional()
  @IsString()
  insuranceProvider?: string | null;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  insuranceAmount?: number | null;

  @IsOptional()
  insuranceExpiry?: string | null;

  @IsOptional()
  @IsString()
  ownerName?: string | null;

  @IsOptional()
  @IsString()
  ownerContact?: string | null;

  @IsOptional()
  @IsString()
  ownerAddress?: string | null;

  @IsOptional()
  @IsString()
  roadworthyCertificateNumber?: string | null;

  @IsOptional()
  roadworthyExpiry?: string | null;

  @IsOptional()
  @IsString()
  permitNumber?: string | null;

  @IsOptional()
  permitExpiry?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

class UpdateVehicleDto {
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  make?: string | null;

  @IsOptional()
  @IsString()
  model?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  vin?: string | null;

  @IsOptional()
  @IsString()
  engineNumber?: string | null;

  @IsOptional()
  @IsString()
  licenseDiskNumber?: string | null;

  @IsOptional()
  licenseDiskExpiry?: string | null;

  @IsOptional()
  @IsString()
  insuranceProvider?: string | null;

  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  insuranceAmount?: number | null;

  @IsOptional()
  insuranceExpiry?: string | null;

  @IsOptional()
  @IsString()
  ownerName?: string | null;

  @IsOptional()
  @IsString()
  ownerContact?: string | null;

  @IsOptional()
  @IsString()
  ownerAddress?: string | null;

  @IsOptional()
  @IsString()
  roadworthyCertificateNumber?: string | null;

  @IsOptional()
  roadworthyExpiry?: string | null;

  @IsOptional()
  @IsString()
  permitNumber?: string | null;

  @IsOptional()
  permitExpiry?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

@Controller('tenant/vehicles')
@ApiTags('tenant-vehicles')
export class TenantVehiclesController {
  constructor(private readonly tenantVehiclesService: TenantVehiclesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  findAll(): Promise<TenantVehicle[]> {
    return this.tenantVehiclesService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateVehicleDto): Promise<TenantVehicle> {
    return this.tenantVehiclesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<TenantVehicle> {
    return this.tenantVehiclesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantVehiclesService.remove(id);
  }
}

