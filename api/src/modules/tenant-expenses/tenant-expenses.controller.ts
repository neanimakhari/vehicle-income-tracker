import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantExpense } from './tenant-expense.entity';
import { TenantExpensesService } from './tenant-expenses.service';
import { ApiTags } from '@nestjs/swagger';

class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsString()
  @IsOptional()
  receiptImage?: string;

  @IsDateString()
  loggedOn: string;
}

@Controller('tenant/expenses')
@ApiTags('tenant-expenses')
export class TenantExpensesController {
  constructor(private readonly tenantExpensesService: TenantExpensesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  findAll(): Promise<TenantExpense[]> {
    return this.tenantExpensesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<TenantExpense> {
    return this.tenantExpensesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateExpenseDto): Promise<TenantExpense> {
    return this.tenantExpensesService.create(dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantExpensesService.remove(id);
  }
}

