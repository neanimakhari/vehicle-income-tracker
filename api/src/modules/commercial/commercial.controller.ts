import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
} from 'class-validator';
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

@Controller('platform/commercial')
@ApiTags('commercial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('modules')
  listModules() {
    return this.commercialService.listModules();
  }

  @Get('plans')
  listPlans() {
    return this.commercialService.listPlans();
  }

  @Put('plans/:id/modules')
  updatePlanModules(
    @Param('id') id: string,
    @Body() dto: UpdatePlanModulesDto,
  ) {
    return this.commercialService.updatePlanModules(id, dto.moduleKeys);
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
