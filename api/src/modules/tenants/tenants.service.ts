import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { TenantSchemasService } from './tenants.schemas.service';
import { AuditService } from '../../modules/audit/audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantSchemasService: TenantSchemasService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      order: { name: 'ASC' },
    });
  }

  /** Per-tenant usage for billing and reporting. Includes id/name for easy invoicing. */
  async getUsageForAll(): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      drivers: number;
      incomes: number;
      vehicles: number;
      totalIncome: number;
    }>
  > {
    const tenants = await this.findAll();
    const result = await Promise.all(
      tenants.map(async (t) => {
        const usage = await this.tenantSchemasService.getUsage(t.slug);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          drivers: usage.drivers,
          incomes: usage.incomes,
          vehicles: usage.vehicles,
          totalIncome: usage.totalIncome,
        };
      }),
    );
    return result;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async create(
    data: Pick<
      Tenant,
      | 'name'
      | 'slug'
      | 'contactName'
      | 'contactEmail'
      | 'contactPhone'
      | 'address'
      | 'registrationNumber'
      | 'taxId'
      | 'website'
      | 'notes'
    >,
    actor?: { userId?: string; role?: string },
  ): Promise<Tenant> {
    const tenant = this.tenantRepository.create({
      name: data.name,
      slug: data.slug,
      isActive: true,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      address: data.address ?? null,
      registrationNumber: data.registrationNumber ?? null,
      taxId: data.taxId ?? null,
      website: data.website ?? null,
      notes: data.notes ?? null,
    });
    const saved = await this.tenantRepository.save(tenant);
    await this.tenantSchemasService.ensureTenantSchema(saved.slug);
    await this.auditService.log({
      action: 'tenant.create',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      targetType: 'tenant',
      targetId: saved.id,
      metadata: { slug: saved.slug, name: saved.name },
    });

    // Notify platform admins (optional: skip if disabled via env)
    if (this.configService.get<boolean>('platform.sendNewTenantCreatedEmail') === false) {
      return saved;
    }
    const notifyEmails = this.configService.get<string>('platform.adminNotifyEmails');
    const recipientList = notifyEmails
      ? notifyEmails.split(',').map((e) => e.trim()).filter(Boolean)
      : await this.dataSource
          .query(
            `SELECT email FROM "platform"."auth_users" WHERE role = 'PLATFORM_ADMIN' AND is_active = true`,
          )
          .then((rows: { email: string }[]) => rows.map((r) => r.email));
    if (recipientList.length > 0) {
      try {
        await this.emailService.sendNewTenantCreatedEmail(
          recipientList,
          saved.name || saved.slug,
          saved.slug,
        );
      } catch (err) {
        console.error('Error sending new tenant created email:', err);
      }
    }
    return saved;
  }

  async update(
    id: string,
    data: {
      isActive?: boolean;
      requireMfa?: boolean;
      requireMfaUsers?: boolean;
      requireBiometrics?: boolean;
      sessionTimeoutMinutes?: number | null;
      enforceIpAllowlist?: boolean;
      allowedIps?: string[] | null;
      enforceDeviceAllowlist?: boolean;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      address?: string | null;
      registrationNumber?: string | null;
      taxId?: string | null;
      website?: string | null;
      notes?: string | null;
      maxDrivers?: number | null;
      maxStorageMb?: number | null;
    },
  ): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    if (data.isActive !== undefined) {
      tenant.isActive = data.isActive;
    }
    if (data.requireMfa !== undefined) {
      tenant.requireMfa = data.requireMfa;
    }
    if (data.requireMfaUsers !== undefined) {
      tenant.requireMfaUsers = data.requireMfaUsers;
    }
    if (data.requireBiometrics !== undefined) {
      tenant.requireBiometrics = data.requireBiometrics;
    }
    if (data.sessionTimeoutMinutes !== undefined) {
      tenant.sessionTimeoutMinutes = data.sessionTimeoutMinutes;
    }
    if (data.enforceIpAllowlist !== undefined) {
      tenant.enforceIpAllowlist = data.enforceIpAllowlist;
    }
    if (data.allowedIps !== undefined) {
      tenant.allowedIps = data.allowedIps;
    }
    if (data.enforceDeviceAllowlist !== undefined) {
      tenant.enforceDeviceAllowlist = data.enforceDeviceAllowlist;
    }
    if (data.contactName !== undefined) {
      tenant.contactName = data.contactName;
    }
    if (data.contactEmail !== undefined) {
      tenant.contactEmail = data.contactEmail;
    }
    if (data.contactPhone !== undefined) {
      tenant.contactPhone = data.contactPhone;
    }
    if (data.address !== undefined) {
      tenant.address = data.address;
    }
    if (data.registrationNumber !== undefined) {
      tenant.registrationNumber = data.registrationNumber;
    }
    if (data.taxId !== undefined) {
      tenant.taxId = data.taxId;
    }
    if (data.website !== undefined) {
      tenant.website = data.website;
    }
    if (data.notes !== undefined) {
      tenant.notes = data.notes;
    }
    if (data.maxDrivers !== undefined) {
      tenant.maxDrivers = data.maxDrivers;
    }
    if (data.maxStorageMb !== undefined) {
      tenant.maxStorageMb = data.maxStorageMb;
    }
    const saved = await this.tenantRepository.save(tenant);
    await this.auditService.log({
      action: 'tenant.update',
      actorUserId: null,
      actorRole: 'PLATFORM_ADMIN',
      targetType: 'tenant',
      targetId: saved.id,
      metadata: {
        slug: saved.slug,
        isActive: saved.isActive,
        requireMfa: saved.requireMfa,
        requireMfaUsers: saved.requireMfaUsers,
        requireBiometrics: saved.requireBiometrics,
        sessionTimeoutMinutes: saved.sessionTimeoutMinutes,
        enforceIpAllowlist: saved.enforceIpAllowlist,
        allowedIps: saved.allowedIps,
        enforceDeviceAllowlist: saved.enforceDeviceAllowlist,
      },
    });
    return saved;
  }
}

