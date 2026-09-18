import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverEmailIndex } from './driver-email-index.entity';

@Injectable()
export class DriverEmailIndexService {
  constructor(
    @InjectRepository(DriverEmailIndex)
    private readonly repo: Repository<DriverEmailIndex>,
  ) {}

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async upsert(email: string, tenantSlug: string, userId: string): Promise<void> {
    const emailNormalized = DriverEmailIndexService.normalizeEmail(email);
    if (!emailNormalized || !tenantSlug || !userId) return;
    const existing = await this.repo.findOne({
      where: { emailNormalized, tenantSlug },
    });
    if (existing) {
      existing.userId = userId;
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(
      this.repo.create({ emailNormalized, tenantSlug, userId }),
    );
  }

  async remove(email: string, tenantSlug: string): Promise<void> {
    const emailNormalized = DriverEmailIndexService.normalizeEmail(email);
    if (!emailNormalized || !tenantSlug) return;
    await this.repo.delete({ emailNormalized, tenantSlug });
  }

  async removeByUserId(tenantSlug: string, userId: string): Promise<void> {
    if (!tenantSlug || !userId) return;
    await this.repo.delete({ tenantSlug, userId });
  }

  async findTenantsByEmail(email: string): Promise<DriverEmailIndex[]> {
    const emailNormalized = DriverEmailIndexService.normalizeEmail(email);
    if (!emailNormalized) return [];
    return this.repo.find({
      where: { emailNormalized },
      order: { tenantSlug: 'ASC' },
    });
  }
}
