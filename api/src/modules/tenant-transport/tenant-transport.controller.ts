import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
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
import { TenantTransportService } from './tenant-transport.service';

class GroupDto {
  @IsString() name: string;
  @IsString() @IsOptional() kind?: string;
  @IsNumber() @Type(() => Number) @IsOptional() defaultAmount?: number;
  @IsString() @IsOptional() cadence?: string;
  @IsNumber() @Type(() => Number) @IsOptional() dueDay?: number;
  @IsNumber() @Type(() => Number) @IsOptional() graceDays?: number;
  @IsString() @IsOptional() notes?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

class PassengerDto {
  @IsString() name: string;
  @IsString() @IsOptional() type?: string;
  @IsString() @IsOptional() contactName?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() notes?: string;
  @IsUUID() @IsOptional() householdId?: string;
  @IsUUID() @IsOptional() groupId?: string;
  @IsUUID() @IsOptional() vehicleId?: string;
  @IsUUID() @IsOptional() driverUserId?: string;
  @IsNumber() @Type(() => Number) @IsOptional() feeAmount?: number;
  @IsString() @IsOptional() feeCadence?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

class ImportRowDto {
  @IsString() name: string;
  @IsString() @IsOptional() type?: string;
  @IsString() @IsOptional() vehicleReg?: string;
  @IsString() @IsOptional() groupName?: string;
  @IsNumber() @Type(() => Number) @IsOptional() feeAmount?: number;
  @IsString() @IsOptional() cadence?: string;
  @IsString() @IsOptional() contactName?: string;
  @IsString() @IsOptional() phone?: string;
}

class ImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}

class PauseDto {
  @IsString() label: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

class ClaimDto {
  @IsUUID() passengerId: string;
  @IsUUID() @IsOptional() billingPeriodId?: string;
  @IsNumber() @Type(() => Number) amount: number;
  @IsString() @IsOptional() method?: string;
  @IsDateString() @IsOptional() paidAt?: string;
  @IsString() @IsOptional() notes?: string;
  @IsUUID() @IsOptional() collectedByDriverId?: string;
  @IsBoolean() @IsOptional() autoApprove?: boolean;
}

class RejectDto {
  @IsString() reason: string;
}

@Controller('tenant/transport')
@ApiTags('tenant-transport')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  TenantContextGuard,
  TenantAccessGuard,
  ModuleEntitlementGuard,
)
@RequiresModule('scholar_payments')
@Roles('TENANT_ADMIN')
export class TenantTransportController {
  constructor(private readonly transport: TenantTransportService) {}

  @Get('groups')
  listGroups() {
    return this.transport.listGroups();
  }

  @Post('groups')
  createGroup(@Body() dto: GroupDto) {
    return this.transport.createGroup(dto);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<GroupDto>) {
    return this.transport.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.transport.deleteGroup(id);
  }

  @Get('pauses')
  listPauses() {
    return this.transport.listPauses();
  }

  @Post('pauses')
  createPause(@Body() dto: PauseDto) {
    return this.transport.createPause(dto);
  }

  @Delete('pauses/:id')
  deletePause(@Param('id', ParseUUIDPipe) id: string) {
    return this.transport.deletePause(id);
  }

  @Get('passengers')
  listPassengers(
    @Query('vehicleId') vehicleId?: string,
    @Query('groupId') groupId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.transport.listPassengers({
      vehicleId,
      groupId,
      activeOnly: activeOnly !== 'false',
    });
  }

  @Post('passengers')
  createPassenger(@Body() dto: PassengerDto) {
    return this.transport.createPassenger(dto);
  }

  @Patch('passengers/:id')
  updatePassenger(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<PassengerDto>,
  ) {
    return this.transport.updatePassenger(id, dto);
  }

  @Post('passengers/import')
  importPassengers(@Body() dto: ImportDto) {
    return this.transport.importPassengers(dto.rows ?? []);
  }

  @Post('households')
  newHousehold() {
    return this.transport.newHouseholdId();
  }

  @Post('periods/generate')
  generatePeriods(@Body() body: { anchor?: string }) {
    return this.transport.ensurePeriodsForAnchor(body?.anchor);
  }

  @Get('arrears')
  arrears(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('anchor') anchor?: string,
  ) {
    return this.transport.getArrears({ from, to, anchor });
  }

  @Get('payments')
  listPayments(@Query('status') status?: string) {
    return this.transport.listClaims(status);
  }

  @Post('payments')
  createPayment(
    @Body() dto: ClaimDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.transport.createClaim(dto, req.user);
  }

  /** Driver: passengers assigned to me */
  @Get('driver/passengers')
  @Roles('TENANT_USER', 'TENANT_ADMIN')
  driverPassengers(@Req() req: { user?: { sub?: string; role?: string } }) {
    const userId = req.user?.sub;
    if (!userId) return [];
    // Admins can use this too to preview; still scoped to their user id
    return this.transport.listPassengersForDriver(userId);
  }

  /** Driver: my payment claims */
  @Get('driver/payments')
  @Roles('TENANT_USER', 'TENANT_ADMIN')
  driverPayments(
    @Req() req: { user?: { sub?: string } },
    @Query('status') status?: string,
  ) {
    const userId = req.user?.sub;
    if (!userId) return [];
    return this.transport.listClaimsForDriver(userId, status);
  }

  /** Driver: submit a payment claim (pending admin approval) */
  @Post('driver/payments')
  @Roles('TENANT_USER', 'TENANT_ADMIN')
  driverCreatePayment(
    @Body() dto: ClaimDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.transport.createDriverClaim(
      {
        passengerId: dto.passengerId,
        billingPeriodId: dto.billingPeriodId,
        amount: dto.amount,
        method: dto.method,
        paidAt: dto.paidAt,
        notes: dto.notes,
      },
      { sub: req.user?.sub },
    );
  }

  @Post('payments/:id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.transport.approveClaim(id, req.user);
  }

  @Post('payments/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.transport.rejectClaim(id, dto.reason, req.user);
  }

  @Get('reports/by-vehicle')
  byVehicle(@Query('from') from?: string, @Query('to') to?: string) {
    return this.transport.reportByVehicle(from, to);
  }

  @Get('reports/by-group')
  byGroup(@Query('from') from?: string, @Query('to') to?: string) {
    return this.transport.reportByGroup(from, to);
  }

  @Get('reports/summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.transport.summary(from, to);
  }

  @Get('reports/driver-collections')
  driverCollections(@Query('from') from?: string, @Query('to') to?: string) {
    return this.transport.driverCollectionSummary(from, to);
  }
}
