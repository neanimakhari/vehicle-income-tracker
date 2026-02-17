import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { TenantAuthService } from './tenant-auth.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { Tenant } from '../tenants/tenant.entity';
import { RefreshToken } from '../../auth/refresh-token.entity';
import { DeviceBinding } from '../../auth/device-binding.entity';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

describe('TenantAuthService', () => {
  let service: TenantAuthService;
  let tenantContext: { getTenantId: jest.Mock };
  let mockRepo: { findOne: jest.Mock; save: jest.Mock };
  let tenantRepo: { findOne: jest.Mock };
  let emailService: { sendEmailOtp: jest.Mock };

  beforeEach(async () => {
    tenantContext = { getTenantId: jest.fn().mockReturnValue('demo') };
    mockRepo = { findOne: jest.fn(), save: jest.fn().mockImplementation((x) => Promise.resolve(x)) };
    tenantRepo = { findOne: jest.fn().mockResolvedValue({ name: 'Demo', slug: 'demo' }) };
    emailService = { sendEmailOtp: jest.fn().mockResolvedValue({ sent: true }) };

    const mockTenantScope = {};
    const getTenantRepo = () => ({
      withSchema: (fn: (r: typeof mockRepo) => Promise<unknown>) => fn(mockRepo),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantAuthService,
        { provide: DataSource, useValue: {} },
        { provide: TenantScopeService, useValue: mockTenantScope },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(DeviceBinding), useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<TenantAuthService>(TenantAuthService);
    (service as any).getTenantRepo = getTenantRepo;
  });

  describe('sendEmailOtp', () => {
    it('throws when tenant context missing', async () => {
      tenantContext.getTenantId.mockReturnValue(null);
      await expect(service.sendEmailOtp('u@t.com')).rejects.toThrow(UnauthorizedException);
    });

    it('returns generic message and sends OTP when user exists and not verified', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: '1',
        email: 'u@t.com',
        isActive: true,
        emailVerified: false,
      });

      const result = await service.sendEmailOtp('u@t.com');

      expect(result.message).toContain('If an account exists');
      expect(emailService.sendEmailOtp).toHaveBeenCalledWith(
        'u@t.com',
        expect.stringMatching(/^\d{6}$/),
        'Demo',
      );
    });

    it('returns "already verified" when user is verified', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: '1',
        email: 'u@t.com',
        isActive: true,
        emailVerified: true,
      });

      const result = await service.sendEmailOtp('u@t.com');

      expect(result.message).toBe('Email is already verified');
      expect(emailService.sendEmailOtp).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailWithOtp', () => {
    it('throws when tenant context missing', async () => {
      tenantContext.getTenantId.mockReturnValue(null);
      await expect(service.verifyEmailWithOtp('u@t.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when code invalid or expired', async () => {
      tenantContext.getTenantId.mockReturnValue('demo');
      await expect(service.verifyEmailWithOtp('u@t.com', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('verifies user and clears token when code valid', async () => {
      const store = (service as any).emailOtpStore as Map<string, { code: string; expiresAt: number }>;
      store.set('demo:u@t.com', { code: '123456', expiresAt: Date.now() + 60000 });

      mockRepo.findOne.mockResolvedValue({
        id: '1',
        email: 'u@t.com',
        isActive: true,
        emailVerified: false,
        emailVerificationToken: 't',
        emailVerificationExpires: new Date(),
      });

      const result = await service.verifyEmailWithOtp('u@t.com', '123456');

      expect(result.verified).toBe(true);
      expect(result.message).toBe('Email verified successfully');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'u@t.com',
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }),
      );
    });
  });
});
