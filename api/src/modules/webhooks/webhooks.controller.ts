import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsString, IsUrl, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { WebhooksService } from './webhooks.service';
import { WebhookSubscription } from './webhook-subscription.entity';
import { ApiTags } from '@nestjs/swagger';

class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsString()
  @MinLength(16, { message: 'Secret must be at least 16 characters' })
  secret: string;

  @IsArray()
  @IsString({ each: true })
  eventTypes: string[];
}

@Controller('tenant/webhooks')
@ApiTags('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  list(): Promise<WebhookSubscription[]> {
    return this.webhooksService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  register(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.register(dto.url, dto.secret, dto.eventTypes);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  unregister(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.webhooksService.unregister(id);
  }
}

