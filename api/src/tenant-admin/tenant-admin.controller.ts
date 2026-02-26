import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantAdminService } from './tenant-admin.service';
import { ApiTags } from '@nestjs/swagger';

class CreateTenantAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and a symbol',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  tenantSlug: string;
}

class UpdateTenantAdminDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tenantSlug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('tenant/admins')
@ApiTags('tenant-admins')
export class TenantAdminController {
  constructor(private readonly tenantAdminService: TenantAdminService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  create(@Body() dto: CreateTenantAdminDto) {
    return this.tenantAdminService.create(dto.email, dto.password, dto.tenantSlug);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  findAll() {
    return this.tenantAdminService.findAll();
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTenantAdminDto) {
    return this.tenantAdminService.update(id, {
      email: dto.email,
      tenantSlug: dto.tenantSlug,
      isActive: dto.isActive,
    });
  }
}

