import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantUser } from './tenant-user.entity';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { Tenant } from '../tenants/tenant.entity';
import { RefreshToken } from '../../auth/refresh-token.entity';
import { DeviceBinding } from '../../auth/device-binding.entity';
import { AuditService } from '../audit/audit.service';
import { randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';

const EMAIL_OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class TenantAuthService {
  private readonly emailOtpStore = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(DeviceBinding)
    private readonly deviceBindingRepository: Repository<DeviceBinding>,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  private getTenantRepo() {
    return new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
  }

  private getLockoutConfig() {
    return {
      maxAttempts: this.configService.get<number>('auth.maxLoginAttempts') ?? 5,
      lockoutMinutes: this.configService.get<number>('auth.lockoutMinutes') ?? 15,
    };
  }

  async validateUser(email: string, password: string): Promise<TenantUser> {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { email } });
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
        await repo.save(user);
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.failedLoginAttempts > 0 || user.lockedUntil) {
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        await repo.save(user);
      }
      return user;
    });
  }

  async login(
    email: string,
    password: string,
    mfaToken?: string,
    context?: { ip?: string; deviceId?: string; deviceName?: string; pushToken?: string },
  ) {
    const tenantSlug = this.tenantContext.getTenantId();
    if (!tenantSlug) {
      throw new UnauthorizedException('Tenant context missing');
    }
    let user;
    try {
      user = await this.validateUser(email, password);
    } catch (e) {
      await this.auditService.log({
        action: 'tenant.auth.login_failed',
        actorUserId: null,
        actorRole: null,
        targetType: null,
        targetId: null,
        metadata: { email, tenant: tenantSlug },
      });
      throw e;
    }
    try {
      const ipAddress = context?.ip ?? null;

      const tenant = await this.tenantRepository.findOne({
        where: { slug: tenantSlug },
      });
      if (!tenant) {
        throw new UnauthorizedException('Tenant not found');
      }
      if (!user.mfaEnabled) {
        if (tenant?.requireMfaUsers) {
          throw new UnauthorizedException('MFA setup required');
        }
      }
      let deviceBindingId: string | null = null;
      try {
        if (tenant?.enforceDeviceAllowlist) {
          const device = await this.assertDeviceAllowed({
            userId: user.id,
            userRole: 'TENANT_USER',
            tenantId: tenantSlug,
            deviceId: context?.deviceId,
            deviceName: context?.deviceName,
            pushToken: context?.pushToken,
          });
          deviceBindingId = device?.id ?? null;
        } else {
          const device = await this.upsertDeviceBinding({
            userId: user.id,
            userRole: 'TENANT_USER',
            tenantId: tenantSlug,
            deviceId: context?.deviceId,
            deviceName: context?.deviceName,
            pushToken: context?.pushToken,
            trustByDefault: true,
          });
          deviceBindingId = device?.id ?? null;
        }
      } catch (deviceError) {
        // Log device binding errors but don't fail login if device binding is optional
        console.error('Device binding error (non-fatal):', deviceError);
        // Only fail if device allowlist is enforced
        if (tenant?.enforceDeviceAllowlist) {
          throw deviceError;
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
        role: 'TENANT_USER',
        tenantId: tenantSlug,
      };

      const refreshExpiresIn = (this.configService.get<string>('auth.jwtRefreshExpiresIn') ?? '7d') as StringValue;

      const tokens = await this.issueTokens(payload, refreshExpiresIn);

      const previousIp = user.lastLoginIp;
      try {
        await this.getTenantRepo().withSchema(async repo => {
          if (ipAddress) {
            user.lastLoginIp = ipAddress;
          }
          user.lastLoginAt = new Date();
          await repo.save(user);
        });
      } catch (saveError) {
        console.error('Error saving user login info (non-fatal):', saveError);
        // Continue even if saving login info fails
      }

      try {
        if (ipAddress && previousIp && previousIp !== ipAddress) {
          await this.auditService.log({
            action: 'tenant.auth.suspicious_login',
            actorUserId: user.id,
            actorRole: 'TENANT_USER',
            targetType: 'tenant_user',
            targetId: user.id,
            metadata: { ip: ipAddress, tenant: tenantSlug },
          });
        } else {
          await this.auditService.log({
            action: 'tenant.auth.login',
            actorUserId: user.id,
            actorRole: 'TENANT_USER',
            targetType: 'tenant_user',
            targetId: user.id,
            metadata: { ip: ipAddress, tenant: tenantSlug },
          });
        }
      } catch (auditError) {
        console.error('Error logging audit (non-fatal):', auditError);
        // Continue even if audit logging fails
      }

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        deviceBindingId,
        user: {
          id: user.id,
          email: user.email,
          role: 'TENANT_USER',
          tenantId: tenantSlug,
          mfaEnabled: user.mfaEnabled,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      // Re-throw UnauthorizedException as-is so the client gets the real message
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Surface common causes with user-friendly messages
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema')) {
        throw new UnauthorizedException('Tenant not found or not set up. Check the tenant slug or contact your administrator.');
      }
      if (msg.includes('Tenant not found') || msg.includes('tenant')) {
        throw new UnauthorizedException('Tenant not found. Please check the tenant slug.');
      }
      throw new UnauthorizedException('Login failed. Please try again.');
    }
  }

  async setupMfaWithCredentials(email: string, password: string) {
    const user = await this.validateUser(email, password);
    return this.setupMfa(user.id);
  }

  async verifyMfaWithCredentials(email: string, password: string, token: string) {
    const user = await this.validateUser(email, password);
    return this.verifyMfa(user.id, token);
  }

  async setupMfa(userId: string) {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const secret = speakeasy.generateSecret({
        name: `VIT Driver (${user.email})`,
      });
      user.mfaSecret = secret.base32;
      user.mfaEnabled = false;
      await repo.save(user);
      const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url ?? '');
      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeDataUrl,
      };
    });
  }

  async verifyMfa(userId: string, token: string) {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { id: userId } });
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
      await repo.save(user);
      return { enabled: true };
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        tenantId: string;
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
    payload: { sub: string; email: string; role: string; tenantId: string },
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
    tenantId: string;
    deviceId?: string;
    deviceName?: string;
    pushToken?: string;
  }): Promise<DeviceBinding | null> {
    try {
      if (!input.deviceId) {
        throw new UnauthorizedException('Device approval required');
      }
      const existing = await this.deviceBindingRepository.findOne({
        where: {
          userId: input.userId,
          userRole: input.userRole,
          tenantId: input.tenantId,
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
    } catch (error) {
      console.error('Error in assertDeviceAllowed:', error);
      // Re-throw UnauthorizedException as-is
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // For other errors, throw a generic device approval error
      throw new UnauthorizedException('Device approval required');
    }
  }

  private async upsertDeviceBinding(input: {
    userId: string;
    userRole: string;
    tenantId: string;
    deviceId?: string;
    deviceName?: string;
    pushToken?: string;
    trustByDefault: boolean;
  }): Promise<DeviceBinding | null> {
    try {
      if (!input.deviceId) return null;
      const existing = await this.deviceBindingRepository.findOne({
        where: {
          userId: input.userId,
          userRole: input.userRole,
          tenantId: input.tenantId,
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
    } catch (error) {
      console.error('Error in upsertDeviceBinding:', error);
      // Return null instead of throwing to allow login to continue
      return null;
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { email } });
      if (!user || !user.isActive) {
        // Don't reveal if user exists for security
        return { message: 'If an account exists with this email, a password reset link has been sent.' };
      }

      // Generate reset token
      const resetToken = randomUUID();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.passwordResetToken = resetToken;
      user.passwordResetExpires = resetExpires;
      await repo.save(user);

      // Get tenant info for email
      const tenantId = this.tenantContext.getTenantId();
      const tenant = tenantId ? await this.tenantRepository.findOne({ where: { slug: tenantId } }) : null;

      // Send reset email (use driver app URL for deep link when set; include tenant for in-app flow)
      try {
        const driverAppUrl = this.configService.get<string>('appUrls.driverApp');
        const baseUrl = driverAppUrl || this.configService.get<string>('appUrls.frontend') || 'http://localhost:3002';
        const path = `reset-password?token=${resetToken}${tenantId ? `&tenant=${encodeURIComponent(tenantId)}` : ''}`;
        const resetUrl = baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
        await this.emailService.sendPasswordResetEmail(
          user.email,
          `${user.firstName} ${user.lastName}`,
          resetUrl,
          tenant?.name || 'VIT',
        );
      } catch (error) {
        console.error('Error sending password reset email:', error);
        // Don't fail the request if email fails
      }

      return { message: 'If an account exists with this email, a password reset link has been sent.' };
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({
        where: {
          passwordResetToken: token,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      if (!user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await repo.save(user);
        throw new UnauthorizedException('Reset token has expired');
      }

      // Update password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      user.passwordHash = passwordHash;
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await repo.save(user);

      return { message: 'Password has been reset successfully' };
    });
  }

  async verifyEmail(token: string): Promise<{ message: string; verified: boolean }> {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({
        where: {
          emailVerificationToken: token,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid verification token');
      }

      if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() < Date.now()) {
        // Generate new token
        const newToken = randomUUID();
        const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.emailVerificationToken = newToken;
        user.emailVerificationExpires = newExpires;
        await repo.save(user);

        // Resend verification email
        try {
          const tenantId = this.tenantContext.getTenantId();
          const tenant = tenantId ? await this.tenantRepository.findOne({ where: { slug: tenantId } }) : null;
          const driverAppUrl = this.configService.get<string>('appUrls.driverApp');
          const baseUrl = driverAppUrl || this.configService.get<string>('appUrls.frontend') || 'http://localhost:3002';
          const path = `verify-email?token=${newToken}${tenantId ? `&tenant=${encodeURIComponent(tenantId)}` : ''}`;
          const verificationUrl = baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
          await this.emailService.sendVerificationEmail(
            user.email,
            `${user.firstName} ${user.lastName}`,
            verificationUrl,
            tenant?.name || 'VIT',
          );
        } catch (error) {
          console.error('Error resending verification email:', error);
        }

        throw new UnauthorizedException('Verification token has expired. A new verification email has been sent.');
      }

      // Verify email
      user.emailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await repo.save(user);

      return { message: 'Email verified successfully', verified: true };
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Update password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      user.passwordHash = passwordHash;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await repo.save(user);

      // Log password change
      await this.auditService.log({
        action: 'PASSWORD_CHANGED',
        actorUserId: userId,
        actorRole: null,
        targetType: 'USER',
        targetId: userId,
        metadata: { changedBy: userId },
      });

      return { message: 'Password has been changed successfully' };
    });
  }

  async sendEmailOtp(email: string): Promise<{ message: string }> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context missing');
    }
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { email } });
      if (!user || !user.isActive) {
        return { message: 'If an account exists with this email and is not verified, a verification code has been sent.' };
      }
      if (user.emailVerified) {
        return { message: 'Email is already verified' };
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const key = `${tenantId}:${email}`;
      this.emailOtpStore.set(key, {
        code,
        expiresAt: Date.now() + EMAIL_OTP_EXPIRY_MS,
      });
      const tenant = await this.tenantRepository.findOne({ where: { slug: tenantId } });
      try {
        await this.emailService.sendEmailOtp(
          user.email,
          code,
          tenant?.name || 'VIT',
        );
      } catch (error) {
        console.error('Error sending email OTP:', error);
        this.emailOtpStore.delete(key);
        throw error;
      }
      return { message: 'If an account exists with this email and is not verified, a verification code has been sent.' };
    });
  }

  async verifyEmailWithOtp(email: string, code: string): Promise<{ message: string; verified: boolean }> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context missing');
    }
    const key = `${tenantId}:${email}`;
    const stored = this.emailOtpStore.get(key);
    if (!stored || stored.expiresAt < Date.now()) {
      this.emailOtpStore.delete(key);
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    if (stored.code !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }
    this.emailOtpStore.delete(key);
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { email } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid verification code');
      }
      user.emailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await repo.save(user);
      return { message: 'Email verified successfully', verified: true };
    });
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const tenantRepo = this.getTenantRepo();
    return tenantRepo.withSchema(async repo => {
      const user = await repo.findOne({ where: { email } });
      if (!user || !user.isActive) {
        // Don't reveal if user exists for security
        return { message: 'If an account exists with this email and is not verified, a verification email has been sent.' };
      }

      if (user.emailVerified) {
        return { message: 'Email is already verified' };
      }

      // Generate new token
      const verificationToken = randomUUID();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = verificationExpires;
      await repo.save(user);

      // Send verification email (use driver app URL for deep link when set; include tenant for in-app flow)
      try {
        const tenantId = this.tenantContext.getTenantId();
        const tenant = tenantId ? await this.tenantRepository.findOne({ where: { slug: tenantId } }) : null;
        const driverAppUrl = this.configService.get<string>('appUrls.driverApp');
        const baseUrl = driverAppUrl || this.configService.get<string>('appUrls.frontend') || 'http://localhost:3002';
        const path = `verify-email?token=${verificationToken}${tenantId ? `&tenant=${encodeURIComponent(tenantId)}` : ''}`;
        const verificationUrl = baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
        await this.emailService.sendVerificationEmail(
          user.email,
          `${user.firstName} ${user.lastName}`,
          verificationUrl,
          tenant?.name || 'VIT',
        );
      } catch (error) {
        console.error('Error sending verification email:', error);
        // Don't fail the request if email fails
      }

      return { message: 'If an account exists with this email and is not verified, a verification email has been sent.' };
    });
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
}

