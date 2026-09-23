import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { ModuleEntitlementGuard } from '../commercial/module-entitlement.guard';
import { RequiresModule } from '../commercial/requires-module.decorator';
import { TenantNotificationsService } from './tenant-notifications.service';

class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

class SendNotificationDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsIn(['TENANT_ADMIN', 'TENANT_USER', ''])
  targetRole?: string | null;

  @IsOptional()
  @IsUUID()
  targetUserId?: string | null;
}

@Controller('tenant/notifications')
@ApiTags('tenant-notifications')
@RequiresModule('notifications')
export class TenantNotificationsController {
  constructor(private readonly notifications: TenantNotificationsService) {}

  @Get('categories')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN')
  listCategories() {
    return this.notifications.listCategories();
  }

  @Post('categories')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.notifications.createCategory(
      dto.name,
      dto.description ?? null,
    );
  }

  @Get('unread-count')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async unreadCount(@Req() req: Request) {
    const user = req.user as { sub?: string; role?: string } | undefined;
    if (!user?.sub || !user.role) return { count: 0 };
    const count = await this.notifications.unreadCount(user.sub, user.role);
    return { count };
  }

  @Get()
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  list(
    @Req() req: Request,
    @Query('view') view?: string,
  ) {
    const user = req.user as { sub?: string; role?: string } | undefined;
    const normalized =
      view === 'sent' && user?.role === 'TENANT_ADMIN' ? 'sent' : 'inbox';
    return this.notifications.listNotifications({
      actorUserId: user?.sub ?? null,
      actorRole: user?.role ?? null,
      view: normalized,
    });
  }

  @Get(':id/reads')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN')
  deliveryStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.getDeliveryStats(id);
  }

  @Post('read-all')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  markAllRead(@Req() req: Request) {
    const user = req.user as { sub?: string; role?: string } | undefined;
    if (!user?.sub || !user.role) return { ok: true, count: 0 };
    return this.notifications.markAllRead(user.sub, user.role);
  }

  @Post(':id/read')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as { sub?: string } | undefined;
    if (!user?.sub) return { ok: true };
    return this.notifications.markRead(id, user.sub);
  }

  @Post('send')
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    TenantContextGuard,
    TenantAccessGuard,
    ModuleEntitlementGuard,
  )
  @Roles('TENANT_ADMIN')
  send(@Body() dto: SendNotificationDto, @Req() req: Request) {
    const user = req.user as { sub?: string } | undefined;
    return this.notifications.send(
      {
        title: dto.title,
        message: dto.message,
        categoryId: dto.categoryId ?? null,
        targetRole: dto.targetRole || null,
        targetUserId: dto.targetUserId ?? null,
        source: 'manual',
        deepLink: null,
        push: true,
      },
      user?.sub ?? null,
    );
  }
}
