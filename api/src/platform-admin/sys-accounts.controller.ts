import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SysAccountsService } from './sys-accounts.service';

class CreateSysAccountDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include uppercase, lowercase and a symbol',
  })
  password: string;
}

class UpdateSysAccountDto {
  @IsBoolean()
  isActive: boolean;
}

@Controller('platform/sys-accounts')
@ApiTags('sys-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class SysAccountsController {
  constructor(private readonly sysAccountsService: SysAccountsService) {}

  @Get()
  findAll() {
    return this.sysAccountsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateSysAccountDto) {
    return this.sysAccountsService.create(dto.email, dto.password);
  }

  @Patch(':id')
  setActive(@Param('id') id: string, @Body() dto: UpdateSysAccountDto) {
    return this.sysAccountsService.setActive(id, dto.isActive);
  }
}
