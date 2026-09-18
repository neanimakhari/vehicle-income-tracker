import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { MobileAppDownloadService } from './mobile-app-download.service';

@ApiTags('tenant-mobile-app')
@Controller('tenant/mobile-app')
export class TenantMobileAppController {
  constructor(private readonly downloads: MobileAppDownloadService) {}

  @Post('download-ticket')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER')
  createTicket(
    @Req() req: { user: { sub: string; email: string; role: string; tenantId: string } },
    @Query('channel') channel?: string,
  ) {
    return this.downloads.createDownloadTicket(req.user, channel === 'staging' ? 'staging' : 'prod');
  }

  @Get('download')
  async download(@Query('ticket') ticket: string, @Res() res: Response) {
    const { stream, size, filename } = this.downloads.openDownloadStream(ticket);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    stream.pipe(res);
  }

  @Post('install-invite/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  invite(
    @Req() req: { user: { sub: string; role: string; tenantId: string } },
    @Param('userId') userId: string,
  ) {
    return this.downloads.createInstallInvite(req.user, userId);
  }

  @Get('invite/:token')
  peekInvite(@Param('token') token: string) {
    return this.downloads.resolveInvite(token);
  }
}
