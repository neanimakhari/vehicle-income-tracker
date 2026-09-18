import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './roles.decorator';
import { MfaVerifyDto } from './dto/mfa-verify.dto';

class ImpersonateDto {
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: { ip?: string }) {
    return this.authService.login(dto.email, dto.password, dto.mfaToken, {
      ip: req.ip,
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      pushToken: dto.pushToken,
      tenantSlug: dto.tenantSlug?.trim() || undefined,
      clientApp: dto.clientApp?.trim() || undefined,
    });
  }

  @Post('impersonate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'SYS')
  impersonate(
    @Body() dto: ImpersonateDto,
    @Request()
    req: {
      ip?: string;
      user: { sub: string; email: string; role: string };
    },
  ) {
    return this.authService.impersonateTenant(req.user, dto.tenantSlug, {
      ip: req.ip,
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@Request() req: { user: { sub: string } }) {
    return this.authService.setupMfa(req.user.sub);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  verifyMfa(
    @Request() req: { user: { sub: string } },
    @Body() dto: MfaVerifyDto,
  ) {
    return this.authService.verifyMfa(req.user.sub, dto.token);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}

