import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantReportRecipient } from './tenant-report-recipient.entity';
import { TenantsService } from './tenants.service';

@Injectable()
export class TenantReportRecipientsService {
  constructor(
    @InjectRepository(TenantReportRecipient)
    private readonly recipientsRepo: Repository<TenantReportRecipient>,
    private readonly tenantsService: TenantsService,
  ) {}

  async listByTenantSlug(tenantSlug: string): Promise<TenantReportRecipient[]> {
    await this.ensureTenant(tenantSlug);
    return this.recipientsRepo.find({
      where: { tenantId: tenantSlug },
      order: { createdAt: 'ASC' },
    });
  }

  async listActiveEmails(tenantSlug: string): Promise<string[]> {
    const rows = await this.recipientsRepo.find({
      where: { tenantId: tenantSlug, isActive: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => r.email);
  }

  async create(
    tenantSlug: string,
    data: { email: string; label?: string | null; isActive?: boolean },
  ): Promise<TenantReportRecipient> {
    await this.ensureTenant(tenantSlug);
    const email = data.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    const existing = await this.recipientsRepo.findOne({
      where: { tenantId: tenantSlug, email },
    });
    if (existing) {
      throw new BadRequestException('Recipient already exists for this tenant');
    }
    const row = this.recipientsRepo.create({
      tenantId: tenantSlug,
      email,
      label: data.label?.trim() || null,
      isActive: data.isActive ?? true,
    });
    return this.recipientsRepo.save(row);
  }

  async update(
    tenantSlug: string,
    id: string,
    data: { email?: string; label?: string | null; isActive?: boolean },
  ): Promise<TenantReportRecipient> {
    await this.ensureTenant(tenantSlug);
    const row = await this.recipientsRepo.findOne({
      where: { id, tenantId: tenantSlug },
    });
    if (!row) {
      throw new NotFoundException('Recipient not found');
    }
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!email) throw new BadRequestException('Email is required');
      row.email = email;
    }
    if (data.label !== undefined) {
      row.label = data.label?.trim() || null;
    }
    if (data.isActive !== undefined) {
      row.isActive = data.isActive;
    }
    return this.recipientsRepo.save(row);
  }

  async remove(tenantSlug: string, id: string): Promise<{ deleted: true }> {
    await this.ensureTenant(tenantSlug);
    const row = await this.recipientsRepo.findOne({
      where: { id, tenantId: tenantSlug },
    });
    if (!row) {
      throw new NotFoundException('Recipient not found');
    }
    await this.recipientsRepo.remove(row);
    return { deleted: true };
  }

  private async ensureTenant(tenantSlug: string) {
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantSlug} not found`);
    }
    return tenant;
  }
}
