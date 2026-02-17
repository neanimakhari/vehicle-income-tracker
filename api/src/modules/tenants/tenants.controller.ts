import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Tenant } from './tenant.entity';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { IsArray, IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';

class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/)
  slug: string;

  @IsString()
  @IsOptional()
  contactName?: string | null;

  @IsString()
  @IsEmail()
  @IsOptional()
  contactEmail?: string | null;

  @IsString()
  @IsOptional()
  contactPhone?: string | null;

  @IsString()
  @IsOptional()
  address?: string | null;

  @IsString()
  @IsOptional()
  registrationNumber?: string | null;

  @IsString()
  @IsOptional()
  taxId?: string | null;

  @IsString()
  @IsOptional()
  website?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;
}

class UpdateTenantDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  requireMfa?: boolean;

  @IsBoolean()
  @IsOptional()
  requireMfaUsers?: boolean;

  @IsBoolean()
  @IsOptional()
  requireBiometrics?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  sessionTimeoutMinutes?: number | null;

  @IsBoolean()
  @IsOptional()
  enforceIpAllowlist?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedIps?: string[] | null;

  @IsBoolean()
  @IsOptional()
  enforceDeviceAllowlist?: boolean;

  @IsString()
  @IsOptional()
  contactName?: string | null;

  @IsString()
  @IsOptional()
  contactEmail?: string | null;

  @IsString()
  @IsOptional()
  contactPhone?: string | null;

  @IsString()
  @IsOptional()
  address?: string | null;

  @IsString()
  @IsOptional()
  registrationNumber?: string | null;

  @IsString()
  @IsOptional()
  taxId?: string | null;

  @IsString()
  @IsOptional()
  website?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxDrivers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxStorageMb?: number | null;
}

@Controller('tenants')
@ApiTags('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  findAll(): Promise<Tenant[]> {
    return this.tenantsService.findAll();
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  getUsage(): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      drivers: number;
      incomes: number;
      vehicles: number;
      totalIncome: number;
    }>
  > {
    return this.tenantsService.getUsageForAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  create(@Body() dto: CreateTenantDto, @Req() req: Request): Promise<Tenant> {
    const data = {
      name: dto.name,
      slug: dto.slug,
      contactName: dto.contactName ?? null,
      contactEmail: dto.contactEmail ?? null,
      contactPhone: dto.contactPhone ?? null,
      address: dto.address ?? null,
      registrationNumber: dto.registrationNumber ?? null,
      taxId: dto.taxId ?? null,
      website: dto.website ?? null,
      notes: dto.notes ?? null,
    };
    return this.tenantsService.create(data, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<Tenant> {
    return this.tenantsService.update(id, dto);
  }
}

