import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../auth/auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { AuditService } from '../modules/audit/audit.service';
import { EmailService } from '../modules/email/email.service';

export type TenantAdminDto = {
  id: string;
  email: string;
  tenantId: string;
  tenantName?: string;
  isActive: boolean;
  createdAt: Date;
};

@Injectable()
export class TenantAdminService {
  constructor(
    @InjectRepository(AuthUser)
    private readonly authUserRepository: Repository<AuthUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async create(email: string, password: string, tenantSlug: string): Promise<AuthUser> {
    const existing = await this.authUserRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('User already exists');
    }

    const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.authUserRepository.create({
      email,
      passwordHash,
      role: 'TENANT_ADMIN',
      tenantId: tenant.slug,
      isActive: true,
    });
    const saved = await this.authUserRepository.save(user);
    await this.auditService.log({
      action: 'tenant.admin.create',
      actorUserId: null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant_admin',
      targetId: saved.id,
      metadata: { email: saved.email, tenant: tenant.slug },
    });

    if (this.configService.get<boolean>('platform.sendTenantAdminWelcomeEmail') === false) {
      return saved;
    }
    const loginUrl =
      this.configService.get<string>('appUrls.tenantAdmin') ?? 'http://localhost:3002';
    const userName = saved.email.split('@')[0] ?? saved.email;
    try {
      await this.emailService.sendTenantAdminWelcomeEmail(
        saved.email,
        userName,
        tenant.name ?? tenant.slug,
        loginUrl,
      );
    } catch (err) {
      console.error('Error sending tenant admin welcome email:', err);
    }
    return saved;
  }

  async findAll(): Promise<TenantAdminDto[]> {
    const users = await this.authUserRepository.find({
      where: { role: 'TENANT_ADMIN' },
      order: { createdAt: 'DESC' },
    });
    if (users.length === 0) return [];
    const slugs = [...new Set(users.map((u) => u.tenantId).filter(Boolean))] as string[];
    const tenants = await this.tenantRepository.find({ where: { slug: In(slugs) } });
    const tenantBySlug = new Map(tenants.map((t) => [t.slug, t]));
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      tenantId: u.tenantId ?? '',
      tenantName: u.tenantId ? tenantBySlug.get(u.tenantId)?.name : undefined,
      isActive: u.isActive,
      createdAt: u.createdAt,
    }));
  }

  async update(
    id: string,
    updates: { email?: string; tenantSlug?: string; isActive?: boolean },
  ): Promise<TenantAdminDto> {
    const user = await this.authUserRepository.findOne({
      where: { id, role: 'TENANT_ADMIN' },
    });
    if (!user) throw new NotFoundException('Tenant admin not found');
    if (updates.email !== undefined) {
      const existing = await this.authUserRepository.findOne({ where: { email: updates.email } });
      if (existing && existing.id !== id) throw new ConflictException('Email already in use');
      user.email = updates.email;
    }
    if (updates.tenantSlug !== undefined) {
      const tenant = await this.tenantRepository.findOne({ where: { slug: updates.tenantSlug } });
      if (!tenant) throw new NotFoundException('Tenant not found');
      user.tenantId = tenant.slug;
    }
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    const saved = await this.authUserRepository.save(user);
    await this.auditService.log({
      action: 'tenant.admin.update',
      actorUserId: null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant_admin',
      targetId: saved.id,
      metadata: { email: saved.email, tenant: saved.tenantId },
    });
    const tenant = saved.tenantId
      ? await this.tenantRepository.findOne({ where: { slug: saved.tenantId } })
      : null;
    return {
      id: saved.id,
      email: saved.email,
      tenantId: saved.tenantId ?? '',
      tenantName: tenant?.name,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }
}

