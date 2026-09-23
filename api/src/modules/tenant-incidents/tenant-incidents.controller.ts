import {
  Body,
  Controller,
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
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import {
  TenantIncidentsService,
} from './tenant-incidents.service';
import type { IncidentStatus } from './tenant-incidents.service';

class CreateIncidentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  vehicle?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@Controller('tenant/incidents')
@ApiTags('tenant-incidents')
@UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
export class TenantIncidentsController {
  constructor(private readonly incidents: TenantIncidentsService) {}

  @Post()
  @Roles('TENANT_USER')
  create(
    @Req() req: { user: { sub: string } },
    @Body() body: CreateIncidentDto,
  ) {
    return this.incidents.create(req.user.sub, body);
  }

  @Get()
  @Roles('TENANT_ADMIN')
  list(@Query('status') status?: string) {
    const allowed: IncidentStatus[] = ['open', 'ack', 'closed'];
    const filter =
      status && (allowed as string[]).includes(status)
        ? (status as IncidentStatus)
        : undefined;
    return this.incidents.list(filter);
  }

  @Patch(':id/ack')
  @Roles('TENANT_ADMIN')
  ack(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.incidents.ack(id, req.user.sub);
  }

  @Patch(':id/close')
  @Roles('TENANT_ADMIN')
  close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.incidents.close(id, req.user.sub);
  }
}
