import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { DailyTargetRulesService } from './daily-target-rules.service';
import { ModuleEntitlementGuard } from '../commercial/module-entitlement.guard';
import { RequiresModule } from '../commercial/requires-module.decorator';

class CreateTargetRuleDto {
  @IsIn(['tenant', 'driver'])
  scope: 'tenant' | 'driver';

  @IsUUID()
  @IsOptional()
  driverUserId?: string | null;

  @IsIn(['weekday', 'date_range', 'exact_date', 'closed'])
  ruleType: 'weekday' | 'date_range' | 'exact_date' | 'closed';

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number | null;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  weekdays?: number[] | null;

  @IsString()
  @IsOptional()
  startDate?: string | null;

  @IsString()
  @IsOptional()
  endDate?: string | null;

  @IsString()
  @IsOptional()
  exactDate?: string | null;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateTargetRuleDto {
  @IsIn(['tenant', 'driver'])
  @IsOptional()
  scope?: 'tenant' | 'driver';

  @IsUUID()
  @IsOptional()
  driverUserId?: string | null;

  @IsIn(['weekday', 'date_range', 'exact_date', 'closed'])
  @IsOptional()
  ruleType?: 'weekday' | 'date_range' | 'exact_date' | 'closed';

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number | null;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  weekdays?: number[] | null;

  @IsString()
  @IsOptional()
  startDate?: string | null;

  @IsString()
  @IsOptional()
  endDate?: string | null;

  @IsString()
  @IsOptional()
  exactDate?: string | null;

  @IsInt()
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Controller('tenant/target-rules')
@ApiTags('tenant-target-rules')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  TenantContextGuard,
  TenantAccessGuard,
  ModuleEntitlementGuard,
)
@RequiresModule('target_calendar')
@Roles('TENANT_ADMIN')
export class DailyTargetRulesController {
  constructor(
    private readonly rulesService: DailyTargetRulesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private tenantSlug(): string {
    const slug = this.tenantContext.getTenantId();
    if (!slug) throw new Error('Tenant context missing');
    return slug;
  }

  @Get()
  @Roles('TENANT_ADMIN')
  list(@Query('driverUserId') driverUserId?: string) {
    return this.rulesService.listForTenant(this.tenantSlug(), driverUserId);
  }

  @Post()
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateTargetRuleDto) {
    return this.rulesService.create(this.tenantSlug(), dto);
  }

  @Patch(':id')
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTargetRuleDto) {
    return this.rulesService.update(this.tenantSlug(), id, dto);
  }

  @Delete(':id')
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string) {
    return this.rulesService.remove(this.tenantSlug(), id);
  }
}
