import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthUser } from './auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { RefreshToken } from './refresh-token.entity';
import { DeviceBinding } from './device-binding.entity';
import { AuditService } from '../modules/audit/audit.service';
import { EmailService } from '../modules/email/email.service';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let authUserRepo: { findOne: jest.Mock; save: jest.Mock };
  let emailService: { sendAdminPasswordResetEmail: jest.Mock };

  const mockUser = {
    id: 'user-1',
    email: 'admin@test.com',
    passwordHash: 'hash',
    role: 'TENANT_ADMIN' as const,
    tenantId: 'demo',
    isActive: true,
    passwordResetToken: null as string | null,
    passwordResetExpires: null as Date | null,
  };

  beforeEach(async () => {
    authUserRepo = { findOne: jest.fn(), save: jest.fn() };
    emailService = { sendAdminPasswordResetEmail: jest.fn().mockResolvedValue({ sent: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(AuthUser), useValue: authUserRepo },
        { provide: getRepositoryToken(Tenant), useValue: {} },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(DeviceBinding), useValue: {} },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'appUrls.tenantAdmin') return 'http://localhost:3002';
              if (key === 'appUrls.systemAdmin') return 'http://localhost:3001';
              return undefined;
            }),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('forgotPassword', () => {
    it('returns generic message when user not found', async () => {
      authUserRepo.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword('nobody@test.com');
      expect(result.message).toContain('If an account exists');
      expect(authUserRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendAdminPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('sets reset token, saves user, and sends email when user exists', async () => {
      authUserRepo.findOne.mockResolvedValue({ ...mockUser });
      authUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.forgotPassword('admin@test.com');

      expect(result.message).toContain('If an account exists');
      expect(authUserRepo.save).toHaveBeenCalled();
      const savedUser = authUserRepo.save.mock.calls[0][0];
      expect(savedUser.passwordResetToken).toBeDefined();
      expect(savedUser.passwordResetExpires).toBeInstanceOf(Date);
      expect(emailService.sendAdminPasswordResetEmail).toHaveBeenCalledWith(
        'admin@test.com',
        expect.any(String),
        expect.stringContaining('/reset-password?token='),
        expect.any(String),
      );
    });
  });

  describe('resetPassword', () => {
    it('throws when token not found', async () => {
      authUserRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'NewPass123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when token expired', async () => {
      authUserRepo.findOne.mockResolvedValue({
        ...mockUser,
        passwordResetToken: 'token',
        passwordResetExpires: new Date(Date.now() - 1000),
      });
      authUserRepo.save.mockResolvedValue(undefined);
      await expect(service.resetPassword('token', 'NewPass123!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('updates password and clears token when valid', async () => {
      const expired = new Date(Date.now() + 60 * 60 * 1000);
      authUserRepo.findOne.mockResolvedValue({
        ...mockUser,
        passwordResetToken: 'valid-token',
        passwordResetExpires: expired,
      });
      authUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.resetPassword('valid-token', 'NewPass123!');

      expect(result.message).toBe('Password has been reset successfully.');
      const savedUser = authUserRepo.save.mock.calls[0][0];
      expect(savedUser.passwordHash).toBeDefined();
      expect(typeof savedUser.passwordHash).toBe('string');
      expect(savedUser.passwordResetToken).toBeNull();
      expect(savedUser.passwordResetExpires).toBeNull();
    });
  });
});
