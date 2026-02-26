import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';

class CreatePlatformAdminDto {
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
  role: 'PLATFORM_ADMIN';
}

@Controller('platform/admins')
@ApiTags('platform-admins')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  create(@Body() dto: CreatePlatformAdminDto) {
    return this.platformAdminService.create(dto.email, dto.password);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  findAll() {
    return this.platformAdminService.findAll();
  }
}

