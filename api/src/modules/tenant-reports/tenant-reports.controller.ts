import { Controller, Get, Post, Query, Req, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantReportsService } from './tenant-reports.service';
import { ApiTags } from '@nestjs/swagger';
import { CustomReportDto } from './dto/custom-report.dto';

@Controller('tenant/reports')
@ApiTags('tenant-reports')
export class TenantReportsController {
  constructor(private readonly tenantReportsService: TenantReportsService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  summary(@Req() req: { user?: { sub?: string; role?: string } }) {
    return this.tenantReportsService.getSummary(req.user);
  }

  @Get('vehicle-stats')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  vehicleStats(@Req() req: { user?: { sub?: string; role?: string } }) {
    return this.tenantReportsService.getVehicleStats(req.user);
  }

  @Get('vehicle-trends')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  vehicleTrends(
    @Req() req: { user?: { sub?: string; role?: string } },
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? Number(days) : 30;
    return this.tenantReportsService.getVehicleTrends(parsedDays, req.user);
  }

  @Get('top-vehicles')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  topVehicles(
    @Req() req: { user?: { sub?: string; role?: string } },
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 10;
    return this.tenantReportsService.getTopVehicles(parsedLimit, req.user);
  }

  @Get('fuel-efficiency/vehicles')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  fuelEfficiencyByVehicle(@Req() req: { user?: { sub?: string; role?: string } }) {
    return this.tenantReportsService.getFuelEfficiencyByVehicle(req.user);
  }

  @Get('fuel-efficiency/drivers')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  fuelEfficiencyByDriver(@Req() req: { user?: { sub?: string; role?: string } }) {
    return this.tenantReportsService.getFuelEfficiencyByDriver(req.user);
  }

  @Get('driver-stats')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  driverStats(@Req() req: { user?: { sub?: string; role?: string } }) {
    return this.tenantReportsService.getDriverStats(req.user);
  }

  @Get('monthly-report')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  monthlyReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    return this.tenantReportsService.getMonthlyReport(start, end);
  }

  @Post('send-monthly-report')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  async sendMonthlyReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('email') email?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);
    return this.tenantReportsService.sendMonthlyReportEmail(start, end, email);
  }

  @Post('custom')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async customReport(
    @Body() dto: CustomReportDto,
    @Req() req: { user?: { sub?: string; role?: string } },
  ) {
    const filters: any = {};
    
    if (dto.singleDate) {
      filters.singleDate = new Date(dto.singleDate);
    } else {
      if (dto.startDate) filters.startDate = new Date(dto.startDate);
      if (dto.endDate) filters.endDate = new Date(dto.endDate);
    }
    
    if (dto.driverIds && dto.driverIds.length > 0) {
      filters.driverIds = dto.driverIds;
    }
    
    if (dto.vehicles && dto.vehicles.length > 0) {
      filters.vehicles = dto.vehicles;
    }
    
    if (dto.groupBy) {
      filters.groupBy = dto.groupBy;
    }
    
    if (dto.metrics && dto.metrics.length > 0) {
      filters.metrics = dto.metrics;
    }

    return this.tenantReportsService.getCustomReport(filters, req.user);
  }
}

