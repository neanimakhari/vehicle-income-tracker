import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantUsersService } from './tenant-users.service';
import { TenantUser } from './tenant-user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';

class CreateTenantUserDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  password: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

class UpdateTenantUserDto {
  @IsOptional()
  isActive?: boolean;
}

@Controller('tenant/users')
@ApiTags('tenant-users')
export class TenantUsersController {
  constructor(private readonly tenantUsersService: TenantUsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  findAll(): Promise<TenantUser[]> {
    return this.tenantUsersService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateTenantUserDto): Promise<TenantUser> {
    return this.tenantUsersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantUserDto,
  ): Promise<TenantUser> {
    return this.tenantUsersService.update(id, dto);
  }

  // Drivers should never be deleted, only disabled
  // @Delete(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  // @Roles('TENANT_ADMIN')
  // remove(@Param('id', new ParseUUIDPipe()) id: string) {
  //   return this.tenantUsersService.remove(id);
  // }

  @Post(':id/mfa/reset')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  resetMfa(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantUsersService.resetMfa(id);
  }

  @Post(':id/mfa/remind')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  remindMfa(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tenantUsersService.sendMfaReminder(id);
  }
}

