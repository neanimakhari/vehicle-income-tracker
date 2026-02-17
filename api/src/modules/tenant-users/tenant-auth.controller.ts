import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantContextGuard } from '../../tenancy/guards/tenant-context.guard';
import { TenantAccessGuard } from '../../tenancy/guards/tenant-access.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { MfaVerifyDto } from '../../auth/dto/mfa-verify.dto';
import { TenantAuthService } from './tenant-auth.service';
import { TenantMfaInitDto } from './dto/tenant-mfa-init.dto';
import { TenantMfaVerifyInitDto } from './dto/tenant-mfa-verify-init.dto';
import { RefreshDto } from '../../auth/dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('tenant-auth')
@Controller('tenant/auth')
export class TenantAuthController {
  constructor(private readonly tenantAuthService: TenantAuthService) {}

  @Post('login')
  @UseGuards(TenantContextGuard)
  async login(@Body() dto: TenantLoginDto, @Request() req: { ip?: string }) {
    try {
      return await this.tenantAuthService.login(dto.email, dto.password, dto.mfaToken, {
        ip: req.ip,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        pushToken: dto.pushToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  @Post('refresh')
  @UseGuards(TenantContextGuard)
  refresh(@Body() dto: RefreshDto) {
    return this.tenantAuthService.refresh(dto.refreshToken);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER')
  setupMfa(@Request() req: { user: { sub: string } }) {
    return this.tenantAuthService.setupMfa(req.user.sub);
  }

  @Post('mfa/setup-init')
  @UseGuards(TenantContextGuard)
  setupMfaInit(@Body() dto: TenantMfaInitDto) {
    return this.tenantAuthService.setupMfaWithCredentials(
      dto.email,
      dto.password,
    );
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER')
  verifyMfa(
    @Request() req: { user: { sub: string } },
    @Body() dto: MfaVerifyDto,
  ) {
    return this.tenantAuthService.verifyMfa(req.user.sub, dto.token);
  }

  @Post('mfa/verify-init')
  @UseGuards(TenantContextGuard)
  verifyMfaInit(@Body() dto: TenantMfaVerifyInitDto) {
    return this.tenantAuthService.verifyMfaWithCredentials(
      dto.email,
      dto.password,
      dto.token,
    );
  }

  @Post('forgot-password')
  @UseGuards(TenantContextGuard)
  forgotPassword(@Body() dto: { email: string }) {
    return this.tenantAuthService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @UseGuards(TenantContextGuard)
  resetPassword(@Body() dto: { token: string; newPassword: string }) {
    return this.tenantAuthService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('verify-email')
  @UseGuards(TenantContextGuard)
  verifyEmail(@Body() dto: { token: string }) {
    return this.tenantAuthService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @UseGuards(TenantContextGuard)
  resendVerification(@Body() dto: { email: string }) {
    return this.tenantAuthService.resendVerificationEmail(dto.email);
  }

  @Post('send-email-otp')
  @UseGuards(TenantContextGuard)
  sendEmailOtp(@Body() dto: { email: string }) {
    return this.tenantAuthService.sendEmailOtp(dto.email);
  }

  @Post('verify-email-otp')
  @UseGuards(TenantContextGuard)
  verifyEmailOtp(@Body() dto: { email: string; code: string }) {
    return this.tenantAuthService.verifyEmailWithOtp(dto.email, dto.code);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantContextGuard, TenantAccessGuard)
  @Roles('TENANT_USER')
  changePassword(
    @Request() req: { user: { sub: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.tenantAuthService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}

