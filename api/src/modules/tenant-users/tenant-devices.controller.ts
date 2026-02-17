import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { DeviceBinding } from '../../auth/device-binding.entity';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

class UpdatePushTokenDto {
  @IsString()
  @IsOptional()
  pushToken?: string;
}

@Controller('tenant/devices')
@ApiTags('tenant-devices')
export class TenantDevicesController {
  constructor(
    @InjectRepository(DeviceBinding)
    private readonly deviceBindingRepository: Repository<DeviceBinding>,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  async findAll() {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }
    return this.deviceBindingRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  @Post('revoke-all')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  async revokeAll() {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }
    const devices = await this.deviceBindingRepository.find({ where: { tenantId } });
    const now = new Date();
    for (const d of devices) {
      d.revokedAt = now;
      d.isTrusted = false;
    }
    if (devices.length > 0) {
      await this.deviceBindingRepository.save(devices);
    }
    return { revoked: devices.length };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER', 'TENANT_ADMIN')
  async findMyDevices(@Req() req: { user: { sub: string } }) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.deviceBindingRepository.find({
      where: { tenantId, userId: req.user.sub },
      order: { lastSeenAt: 'DESC' },
    });
  }

  @Post('me/revoke-all')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER', 'TENANT_ADMIN')
  async revokeAllMyDevices(@Req() req: { user: { sub: string } }) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    const devices = await this.deviceBindingRepository.find({
      where: { tenantId, userId: req.user.sub },
    });
    const now = new Date();
    for (const d of devices) {
      d.revokedAt = now;
      d.isTrusted = false;
    }
    if (devices.length > 0) await this.deviceBindingRepository.save(devices);
    return { revoked: devices.length };
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  async approve(@Param('id', new ParseUUIDPipe()) id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const device = await this.deviceBindingRepository.findOne({ where: { id } });
    if (!device) {
      return { approved: false };
    }
    if (!tenantId || device.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }
    device.isTrusted = true;
    device.revokedAt = null;
    device.lastSeenAt = new Date();
    await this.deviceBindingRepository.save(device);
    return { approved: true };
  }

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN')
  async revoke(@Param('id', new ParseUUIDPipe()) id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const device = await this.deviceBindingRepository.findOne({ where: { id } });
    if (!device) {
      return { revoked: false };
    }
    if (!tenantId || device.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }
    device.isTrusted = false;
    device.revokedAt = new Date();
    await this.deviceBindingRepository.save(device);
    return { revoked: true };
  }

  @Patch(':id/push')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_ADMIN', 'TENANT_USER')
  async updatePushToken(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePushTokenDto,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const device = await this.deviceBindingRepository.findOne({ where: { id } });
    if (!device) {
      return { updated: false };
    }
    if (!tenantId || device.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }
    device.pushToken = dto.pushToken ?? null;
    device.lastSeenAt = new Date();
    await this.deviceBindingRepository.save(device);
    return { updated: true };
  }
}

