import {
  Body,
  Controller,
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
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CommercialService } from './commercial.service';

class UpsertEntitlementDto {
  @IsUUID()
  @IsOptional()
  planId?: string | null;

  @IsObject()
  @IsOptional()
  moduleOverrides?: Record<string, boolean>;

  @IsString()
  @IsOptional()
  trialEndsAt?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsBoolean()
  @IsOptional()
  syncLimitsFromPlan?: boolean;
}

class UpdatePlanModulesDto {
  @IsArray()
  @IsString({ each: true })
  moduleKeys: string[];
}

class CreatePlanDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxDriversDefault?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxStorageMbDefault?: number | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  moduleKeys?: string[];
}

class UpdatePlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxDriversDefault?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxStorageMbDefault?: number | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  moduleKeys?: string[];
}

@Controller('platform/commercial')
@ApiTags('commercial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('modules')
  @Roles('PLATFORM_ADMIN', 'SYS')
  listModules() {
    return this.commercialService.listModules();
  }

  @Get('plans')
  @Roles('PLATFORM_ADMIN', 'SYS')
  listPlans(@Query('all') all?: string) {
    return this.commercialService.listPlans(all === '1' || all === 'true');
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.commercialService.createPlan(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.commercialService.updatePlan(id, dto);
  }

  @Put('plans/:id/modules')
  updatePlanModules(
    @Param('id') id: string,
    @Body() dto: UpdatePlanModulesDto,
  ) {
    return this.commercialService.updatePlanModules(id, dto.moduleKeys);
  }

  @Get('tenants/entitlements-summary')
  @Roles('PLATFORM_ADMIN', 'SYS')
  listTenantEntitlementSummaries() {
    return this.commercialService.listTenantEntitlementSummaries();
  }

  @Get('tenants/:slug/entitlements')
  @Roles('PLATFORM_ADMIN', 'SYS')
  getTenantEntitlement(@Param('slug') slug: string) {
    return this.commercialService.getTenantEntitlement(slug);
  }

  @Patch('tenants/:slug/entitlements')
  upsertTenantEntitlement(
    @Param('slug') slug: string,
    @Body() dto: UpsertEntitlementDto,
  ) {
    return this.commercialService.upsertTenantEntitlement(slug, dto);
  }
}
