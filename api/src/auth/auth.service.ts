import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuthUser } from './auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { RefreshToken } from './refresh-token.entity';
import { DeviceBinding } from './device-binding.entity';
import { AuditService } from '../modules/audit/audit.service';
import { EmailService } from '../modules/email/email.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthUser)
    private readonly authUserRepository: Repository<AuthUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(DeviceBinding)
    private readonly deviceBindingRepository: Repository<DeviceBinding>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  private getLockoutConfig() {
    return {
      maxAttempts: this.configService.get<number>('auth.maxLoginAttempts') ?? 5,
      lockoutMinutes: this.configService.get<number>('auth.lockoutMinutes') ?? 15,
    };
  }

  async validateUser(email: string, password: string): Promise<AuthUser> {
    const user = await this.authUserRepository.findOne({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const { maxAttempts, lockoutMinutes } = this.getLockoutConfig();
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= maxAttempts) {
        user.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      }
      await this.authUserRepository.save(user);
      await this.auditService.log({
        action: 'auth.login_failed',
        actorUserId: null,
        actorRole: null,
        targetType: 'auth_user',
        targetId: user.id,
        metadata: { email: user.email, failedAttempts: user.failedLoginAttempts },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await this.authUserRepository.save(user);
    }

    return user;
  }

  async login(
    email: string,
    password: string,
    mfaToken?: string,
    context?: {
      ip?: string;
      deviceId?: string;
      deviceName?: string;
      pushToken?: string;
      tenantSlug?: string;
    },
  ) {
    const user = await this.validateUser(email, password);
    if (user.role === 'TENANT_ADMIN' && user.tenantId && context?.tenantSlug) {
      if (user.tenantId !== context.tenantSlug) {
        throw new UnauthorizedException('This account is not for the specified tenant.');
      }
    }
    const forceMfaForAdmins =
      this.configService.get<boolean>('auth.forceMfaForAdmins') ?? false;
    const ipAddress = context?.ip ?? null;
    if (!user.mfaEnabled) {
      if (
        forceMfaForAdmins &&
        (user.role === 'PLATFORM_ADMIN' || user.role === 'TENANT_ADMIN')
      ) {
        throw new UnauthorizedException('MFA setup required');
      }
    }
    let deviceBindingId: string | null = null;
    if (user.role === 'TENANT_ADMIN' && user.tenantId) {
      const tenant = await this.tenantRepository.findOne({
        where: { slug: user.tenantId },
      });
      if (!tenant) {
        throw new UnauthorizedException('Tenant not found');
      }
      if (!user.mfaEnabled && tenant?.requireMfa) {
        throw new UnauthorizedException('MFA setup required');
      }
      if (tenant?.enforceDeviceAllowlist) {
        const device = await this.assertDeviceAllowed({
          userId: user.id,
          userRole: user.role,
          tenantId: user.tenantId,
          deviceId: context?.deviceId,
          deviceName: context?.deviceName,
          pushToken: context?.pushToken,
        });
        deviceBindingId = device?.id ?? null;
      } else {
        const device = await this.upsertDeviceBinding({
          userId: user.id,
          userRole: user.role,
          tenantId: user.tenantId,
          deviceId: context?.deviceId,
          deviceName: context?.deviceName,
          pushToken: context?.pushToken,
          trustByDefault: true,
        });
        deviceBindingId = device?.id ?? null;
      }
    }
    if (user.mfaEnabled) {
      if (!mfaToken) {
        throw new UnauthorizedException('MFA required');
      }
      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret ?? '',
        encoding: 'base32',
        token: mfaToken,
        window: 1,
      });
      if (!isValid) {
        throw new UnauthorizedException('Invalid MFA token');
      }
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const refreshExpiresIn = (this.configService.get<string>('auth.jwtRefreshExpiresIn') ?? '7d') as StringValue;

    const tokens = await this.issueTokens(payload, refreshExpiresIn);

    const previousIp = user.lastLoginIp;
    if (ipAddress) {
      user.lastLoginIp = ipAddress;
    }
    user.lastLoginAt = new Date();
    await this.authUserRepository.save(user);

    if (ipAddress && previousIp && previousIp !== ipAddress) {
      await this.auditService.log({
        action: 'auth.suspicious_login',
        actorUserId: user.id,
        actorRole: user.role,
        targetType: 'auth_user',
        targetId: user.id,
        metadata: { ip: ipAddress, tenant: user.tenantId },
      });
    } else {
      await this.auditService.log({
        action: 'auth.login',
        actorUserId: user.id,
        actorRole: user.role,
        targetType: 'auth_user',
        targetId: user.id,
        metadata: { ip: ipAddress, tenant: user.tenantId },
      });
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      deviceBindingId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  async setupMfa(userId: string) {
    const user = await this.authUserRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const secret = speakeasy.generateSecret({
      name: `VIT Platform (${user.email})`,
    });
    user.mfaSecret = secret.base32;
    user.mfaEnabled = false;
    await this.authUserRepository.save(user);
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url ?? '');
    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    };
  }

  async verifyMfa(userId: string, token: string) {
    const user = await this.authUserRepository.findOne({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new UnauthorizedException('MFA not initialized');
    }
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA token');
    }
    user.mfaEnabled = true;
    await this.authUserRepository.save(user);
    return { enabled: true };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        tenantId: string | null;
        jti: string;
      }>(refreshToken, {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
      });

      const tokenRecord = await this.refreshTokenRepository.findOne({
        where: { tokenId: payload.jti },
      });
      if (!tokenRecord || tokenRecord.isRevoked) {
        await this.revokeAllTokens(payload.sub, payload.role, payload.tenantId);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const accessPayload = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
      };

      const refreshExpiresIn = (this.configService.get<string>('auth.jwtRefreshExpiresIn') ?? '7d') as StringValue;

      const tokens = await this.issueTokens(accessPayload, refreshExpiresIn);

      tokenRecord.isRevoked = true;
      tokenRecord.replacedByTokenId = tokens.refreshTokenId;
      tokenRecord.lastUsedAt = new Date();
      await this.refreshTokenRepository.save(tokenRecord);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async issueTokens(
    payload: { sub: string; email: string; role: string; tenantId: string | null },
    refreshExpiresIn: StringValue,
  ) {
    const refreshTokenId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: refreshTokenId },
      {
        secret: this.configService.get<string>('auth.jwtRefreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );
    const accessToken = await this.jwtService.signAsync(payload);

    const expiresAt = new Date(Date.now() + this.msToNumber(refreshExpiresIn));
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenId: refreshTokenId,
        userId: payload.sub,
        userRole: payload.role,
        tenantId: payload.tenantId,
        expiresAt,
        isRevoked: false,
      }),
    );

    return { accessToken, refreshToken, refreshTokenId };
  }

  private async revokeAllTokens(userId: string, role: string, tenantId: string | null) {
    await this.refreshTokenRepository.update(
      { userId, userRole: role, tenantId: tenantId ?? IsNull(), isRevoked: false },
      { isRevoked: true },
    );
  }

  private async assertDeviceAllowed(input: {
    userId: string;
    userRole: string;
    tenantId: string | null;
    deviceId?: string;
    deviceName?: string;
    pushToken?: string;
  }): Promise<DeviceBinding | null> {
    if (!input.deviceId) {
      throw new UnauthorizedException('Device approval required');
    }
    const existing = await this.deviceBindingRepository.findOne({
      where: {
        userId: input.userId,
        userRole: input.userRole,
        tenantId: input.tenantId ?? IsNull(),
        deviceId: input.deviceId,
        revokedAt: IsNull(),
      },
    });
    if (!existing) {
      await this.upsertDeviceBinding({ ...input, trustByDefault: false });
      throw new UnauthorizedException('Device approval required');
    }
    if (!existing.isTrusted) {
      throw new UnauthorizedException('Device approval required');
    }
    existing.lastSeenAt = new Date();
    if (input.pushToken) {
      existing.pushToken = input.pushToken;
    }
    await this.deviceBindingRepository.save(existing);
    return existing;
  }

  private async upsertDeviceBinding(input: {
    userId: string;
    userRole: string;
    tenantId: string | null;
    deviceId?: string;
    deviceName?: string;
    pushToken?: string;
    trustByDefault: boolean;
  }): Promise<DeviceBinding | null> {
    if (!input.deviceId) return null;
    const existing = await this.deviceBindingRepository.findOne({
      where: {
        userId: input.userId,
        userRole: input.userRole,
        tenantId: input.tenantId ?? IsNull(),
        deviceId: input.deviceId,
        revokedAt: IsNull(),
      },
    });
    if (existing) {
      existing.deviceName = input.deviceName ?? existing.deviceName;
      existing.lastSeenAt = new Date();
      if (input.pushToken) {
        existing.pushToken = input.pushToken;
      }
      await this.deviceBindingRepository.save(existing);
      return existing;
    }
    return await this.deviceBindingRepository.save(
      this.deviceBindingRepository.create({
        userId: input.userId,
        userRole: input.userRole,
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        deviceName: input.deviceName ?? null,
        pushToken: input.pushToken ?? null,
        isTrusted: input.trustByDefault,
        lastSeenAt: new Date(),
      }),
    );
  }

  private msToNumber(value: StringValue): number {
    if (typeof value === 'number') return value;
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const amount = Number(match[1]);
    switch (match[2]) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.authUserRepository.findOne({
      where: { email: email.trim(), isActive: true },
    });
    const message = 'If an account exists with this email, a password reset link has been sent.';
    if (!user) return { message };

    const resetToken = randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await this.authUserRepository.save(user);

    const tenantAdminUrl = this.configService.get<string>('appUrls.tenantAdmin') ?? 'http://localhost:3002';
    const systemAdminUrl = this.configService.get<string>('appUrls.systemAdmin') ?? 'http://localhost:3001';
    const baseUrl = user.role === 'PLATFORM_ADMIN' ? systemAdminUrl : tenantAdminUrl;
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    const appName = user.role === 'PLATFORM_ADMIN' ? 'Platform Admin' : 'Tenant Admin';

    try {
      await this.emailService.sendAdminPasswordResetEmail(
        user.email,
        user.email.split('@')[0],
        resetUrl,
        appName,
      );
    } catch (error) {
      console.error('Error sending admin password reset email:', error);
    }
    return { message };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.authUserRepository.findOne({
      where: { passwordResetToken: token },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    if (!user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await this.authUserRepository.save(user);
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.authUserRepository.save(user);
    return { message: 'Password has been reset successfully.' };
  }
}

