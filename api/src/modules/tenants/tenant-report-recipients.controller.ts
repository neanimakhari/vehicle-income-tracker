import {
  Body,
  Controller,
  Delete,
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
  IsOptional,
  IsString,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantReportRecipientsService } from './tenant-report-recipients.service';

class CreateRecipientDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  label?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

class UpdateRecipientDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  label?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Controller('tenants/:slug/report-recipients')
@ApiTags('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class TenantReportRecipientsController {
  constructor(
    private readonly recipientsService: TenantReportRecipientsService,
  ) {}

  @Get()
  list(@Param('slug') slug: string) {
    return this.recipientsService.listByTenantSlug(slug);
  }

  @Post()
  create(@Param('slug') slug: string, @Body() dto: CreateRecipientDto) {
    return this.recipientsService.create(slug, dto);
  }

  @Patch(':id')
  update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecipientDto,
  ) {
    return this.recipientsService.update(slug, id, dto);
  }

  @Delete(':id')
  remove(@Param('slug') slug: string, @Param('id') id: string) {
    return this.recipientsService.remove(slug, id);
  }
}
