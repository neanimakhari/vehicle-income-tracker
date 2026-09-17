import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { TenantSlaDocument } from './tenant-sla-document.entity';
import { TenantSchemasService } from './tenants.schemas.service';
import { AuditService } from '../../modules/audit/audit.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(TenantSlaDocument)
    private readonly tenantSlaRepository: Repository<TenantSlaDocument>,
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

  /**
   * Lightweight list of active tenants for public consumers (e.g. mobile app tenant picker).
   */
  async findAllPublic(): Promise<Array<{ slug: string; name: string }>> {
    const tenants = await this.tenantRepository.find({
      where: { isActive: true },
      select: ['slug', 'name'],
      order: { name: 'ASC' },
    });
    return tenants.map((t) => ({ slug: t.slug, name: t.name }));
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

  async getTenantMetrics(): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      tenantSlug: string;
      isActive: boolean;
      drivers: number;
      vehicles: number;
      incomes: number;
      totalIncome: number;
      maxDrivers: number | null;
      usagePercentDrivers: number | null;
    }>
  > {
    const [tenants, usage] = await Promise.all([
      this.findAll(),
      this.getUsageForAll(),
    ]);
    const usageBySlug = new Map(usage.map((u) => [u.slug, u]));
    return tenants.map((tenant) => {
      const u = usageBySlug.get(tenant.slug);
      const drivers = u?.drivers ?? 0;
      const maxDrivers = tenant.maxDrivers ?? null;
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        isActive: tenant.isActive,
        drivers,
        vehicles: u?.vehicles ?? 0,
        incomes: u?.incomes ?? 0,
        totalIncome: u?.totalIncome ?? 0,
        maxDrivers,
        usagePercentDrivers:
          maxDrivers && maxDrivers > 0
            ? Math.round((drivers / maxDrivers) * 100)
            : null,
      };
    });
  }

  async listSlaDocuments(tenantId: string): Promise<TenantSlaDocument[]> {
    return this.tenantSlaRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createSlaDocument(payload: {
    tenantId: string;
    title: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
  }): Promise<TenantSlaDocument> {
    const item = this.tenantSlaRepository.create({
      tenantId: payload.tenantId,
      title: payload.title,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      contentBase64: payload.contentBase64,
      effectiveFrom: payload.effectiveFrom ?? null,
      effectiveTo: payload.effectiveTo ?? null,
      notes: payload.notes ?? null,
    });
    return this.tenantSlaRepository.save(item);
  }

  async getSlaDocument(
    tenantId: string,
    documentId: string,
  ): Promise<TenantSlaDocument> {
    const item = await this.tenantSlaRepository.findOne({
      where: { id: documentId, tenantId },
    });
    if (!item) throw new NotFoundException('SLA document not found');
    return item;
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
    if (
      this.configService.get<boolean>('platform.sendNewTenantCreatedEmail') ===
      false
    ) {
      return saved;
    }
    const notifyEmails = this.configService.get<string>(
      'platform.adminNotifyEmails',
    );
    const recipientList = notifyEmails
      ? notifyEmails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
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
      featureFlags?: string[];
      missingIncomeReminderEnabled?: boolean;
      missingIncomeCutoffHour?: number;
      missingIncomeTimezone?: string;
      missingIncomeEscalationEnabled?: boolean;
      missingIncomeEscalationHour?: number;
      defaultDailyTargetAmount?: number | null;
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
    if (data.featureFlags !== undefined) {
      tenant.featureFlags = data.featureFlags;
    }
    if (data.missingIncomeReminderEnabled !== undefined) {
      tenant.missingIncomeReminderEnabled = data.missingIncomeReminderEnabled;
    }
    if (data.missingIncomeCutoffHour !== undefined) {
      tenant.missingIncomeCutoffHour = data.missingIncomeCutoffHour;
    }
    if (data.missingIncomeTimezone !== undefined) {
      tenant.missingIncomeTimezone = data.missingIncomeTimezone;
    }
    if (data.missingIncomeEscalationEnabled !== undefined) {
      tenant.missingIncomeEscalationEnabled =
        data.missingIncomeEscalationEnabled;
    }
    if (data.missingIncomeEscalationHour !== undefined) {
      tenant.missingIncomeEscalationHour = data.missingIncomeEscalationHour;
    }
    if (data.defaultDailyTargetAmount !== undefined) {
      tenant.defaultDailyTargetAmount = data.defaultDailyTargetAmount;
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
        featureFlags: saved.featureFlags,
        missingIncomeReminderEnabled: saved.missingIncomeReminderEnabled,
        missingIncomeCutoffHour: saved.missingIncomeCutoffHour,
        missingIncomeTimezone: saved.missingIncomeTimezone,
        missingIncomeEscalationEnabled: saved.missingIncomeEscalationEnabled,
        missingIncomeEscalationHour: saved.missingIncomeEscalationHour,
        defaultDailyTargetAmount: saved.defaultDailyTargetAmount,
      },
    });
    return saved;
  }
}
