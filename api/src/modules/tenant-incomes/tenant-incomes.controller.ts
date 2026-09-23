import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { TenantIncomesService } from './tenant-incomes.service';
import { TenantIncome } from './tenant-income.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags } from '@nestjs/swagger';

class CreateTenantIncomeDto {
  @IsString()
  @IsNotEmpty()
  vehicle: string;

  @IsString()
  @IsNotEmpty()
  driverName: string;

  @IsNumber()
  @Type(() => Number)
  income: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  startingKm?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  endKm?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  petrolPoured?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  petrolLitres?: number;

  @IsString()
  @IsOptional()
  expenseDetail?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  expensePrice?: number;

  @IsString()
  @IsOptional()
  expenseImage?: string;

  @IsString()
  @IsOptional()
  petrolSlip?: string;

  @IsUUID()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  incomeStream?: string;

  @IsUUID()
  @IsOptional()
  tripId?: string;

  @IsUUID()
  @IsOptional()
  scholarPaymentId?: string;

  @IsDateString()
  loggedOn: string;
}

class RejectIncomeDto {
  @IsString()
  @MinLength(1)
  reason: string;
}

class ApproveIncomeDto {
  @IsOptional()
  @IsString()
  reason?: string | null;
}

@Controller('tenant/incomes')
@ApiTags('tenant-incomes')
export class TenantIncomesController {
  constructor(private readonly tenantIncomesService: TenantIncomesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  findAll(
    @Req() req: { user?: { sub?: string; role?: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<TenantIncome[] | { data: TenantIncome[]; total: number; page: number; limit: number }> {
    const pageNum = page != null ? parseInt(page, 10) : undefined;
    const limitNum = limit != null ? parseInt(limit, 10) : undefined;
    if (pageNum != null && !Number.isNaN(pageNum) && limitNum != null && !Number.isNaN(limitNum)) {
      const statusFilter = status === 'pending' ? 'pending' : undefined;
      return this.tenantIncomesService.findAllPaginated(req.user, pageNum, limitNum, statusFilter);
    }
    return this.tenantIncomesService.findAll(req.user);
  }

  @Get('last-odometer')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  getLastOdometer(@Query('vehicle') vehicle: string): Promise<{ lastEndKm: number | null; lastLoggedOn: string | null }> {
    return this.tenantIncomesService.getLastOdometer(vehicle ?? '');
  }

  @Get('missing-vehicles')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  findMissingVehicles(@Query('date') date?: string) {
    return this.tenantIncomesService.findMissingVehicles(date);
  }

  @Get(':id/history')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  history(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantIncomesService.getHistory(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { sub?: string; role?: string } },
  ): Promise<TenantIncome> {
    return this.tenantIncomesService.findOne(id, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  create(
    @Body() dto: CreateTenantIncomeDto,
    @Req() req: { user?: { sub?: string; role?: string } },
  ): Promise<TenantIncome> {
    return this.tenantIncomesService.create(dto, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Partial<CreateTenantIncomeDto>,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.tenantIncomesService.update(id, dto, req.user);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveIncomeDto,
    @Req() req: { user?: { sub?: string } },
  ): Promise<TenantIncome> {
    return this.tenantIncomesService.approve(id, req.user, dto?.reason ?? null);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectIncomeDto,
    @Req() req: { user?: { sub?: string } },
  ): Promise<TenantIncome> {
    return this.tenantIncomesService.reject(id, req.user, dto.reason);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    return this.tenantIncomesService.remove(id, req.user);
  }

  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER', 'TENANT_ADMIN')
  seedDummyData(@Req() req: { user?: { sub?: string; role?: string } }) {
    if (!req.user?.sub) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.tenantIncomesService.seedDummyData({
      sub: req.user.sub,
      role: req.user.role,
    });
  }
}
