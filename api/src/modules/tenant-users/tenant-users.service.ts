import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { TenantUser } from './tenant-user.entity';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { EmailService } from '../email/email.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { WebhooksService } from '../webhooks/webhooks.service';
import { TenantSchemasService } from '../tenants/tenants.schemas.service';

type CreateTenantUserPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
};

type UpdateTenantUserPayload = {
  isActive?: boolean;
};

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly webhooksService: WebhooksService,
    private readonly tenantSchemasService: TenantSchemasService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findAll(): Promise<TenantUser[]> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(repo => repo.find());
  }

  async create(payload: CreateTenantUserPayload): Promise<TenantUser> {
    const tenantSlug = this.tenantContext.getTenantId();
    if (tenantSlug) {
      const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
      if (tenant?.maxDrivers != null && tenant.maxDrivers >= 1) {
        const usage = await this.tenantSchemasService.getUsage(tenantSlug);
        if (usage.drivers >= tenant.maxDrivers) {
          throw new BadRequestException(
            `Tenant driver limit reached (${usage.drivers}/${tenant.maxDrivers}). Contact the platform to increase the limit.`,
          );
        }
      }
    }

    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { email: payload.email } });
      if (existing) {
        throw new ConflictException('User already exists');
      }

      const passwordHash = await bcrypt.hash(payload.password, 12);
      const verificationToken = randomUUID();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const user = repo.create({
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phoneNumber: payload.phoneNumber ?? null,
        passwordHash,
        isActive: true,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      });
      const saved = await repo.save(user);

      // Send verification email (use driver app URL for deep link when set)
      try {
        const tenantId = this.tenantContext.getTenantId();
        const tenant = tenantId ? await this.tenantRepository.findOne({ where: { slug: tenantId } }) : null;
        const driverAppUrl = this.configService.get<string>('appUrls.driverApp');
        const baseUrl = driverAppUrl ?? process.env.FRONTEND_URL ?? 'http://localhost:3002';
        const path = `verify-email?token=${verificationToken}${tenantId ? `&tenant=${encodeURIComponent(tenantId)}` : ''}`;
        const verificationUrl = baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
        await this.emailService.sendVerificationEmail(
          saved.email,
          `${saved.firstName} ${saved.lastName}`,
          verificationUrl,
          tenant?.name || 'VIT',
        );
      } catch (error) {
        console.error('Error sending verification email:', error);
        // Don't fail user creation if email fails
      }
      await this.auditService.log({
        action: 'tenant.user.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_user',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          email: saved.email,
        },
      });
      return saved;
    });
  }

  async update(id: string, payload: UpdateTenantUserPayload): Promise<TenantUser> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }

      if (typeof payload.isActive === 'boolean') {
        existing.isActive = payload.isActive;
      }

      const saved = await repo.save(existing);
      await this.auditService.log({
        action: 'tenant.user.update',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_user',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          isActive: saved.isActive,
        },
      });
      if (existing.isActive && !saved.isActive) {
        void this.webhooksService.dispatch('driver.disabled', {
          id: saved.id,
          email: saved.email,
          firstName: saved.firstName,
          lastName: saved.lastName,
        });
      }
      return saved;
    });
  }

  async remove(id: string) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      await repo.remove(existing);
      await this.auditService.log({
        action: 'tenant.user.delete',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_user',
        targetId: id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          email: existing.email,
        },
      });
      return { deleted: true };
    });
  }

  async resetMfa(id: string) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      existing.mfaEnabled = false;
      existing.mfaSecret = null;
      const saved = await repo.save(existing);
      await this.auditService.log({
        action: 'tenant.user.mfa.reset',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_user',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          email: saved.email,
        },
      });
      return { reset: true };
    });
  }

  async sendMfaReminder(id: string) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('User not found');
      }
      await this.auditService.log({
        action: 'tenant.user.mfa.remind',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_user',
        targetId: existing.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          email: existing.email,
        },
      });
      return { sent: true };
    });
  }
}

