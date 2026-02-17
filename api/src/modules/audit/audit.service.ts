import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

type AuditPayload = {
  action: string;
  actorUserId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  log(payload: AuditPayload): Promise<AuditLog> {
    const entry = this.auditRepository.create({
      action: payload.action,
      actorUserId: payload.actorUserId,
      actorRole: payload.actorRole,
      targetType: payload.targetType,
      targetId: payload.targetId,
      metadata: payload.metadata ?? null,
    });
    return this.auditRepository.save(entry);
  }

  findAll(): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async findWithQuery(params: {
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    order?: 'ASC' | 'DESC';
    page?: number;
    limit?: number;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const order = params.order === 'ASC' ? 'ASC' : 'DESC';
    const sortColumn = params.sort === 'action' ? 'audit.action' : 'audit.created_at';

    const qb = this.auditRepository
      .createQueryBuilder('audit')
      .orderBy(sortColumn, order)
      .skip((page - 1) * limit)
      .take(limit);

    if (params.action?.trim()) {
      qb.andWhere('audit.action = :action', { action: params.action.trim() });
    }
    if (params.dateFrom) {
      qb.andWhere('audit.created_at >= :dateFrom', { dateFrom: params.dateFrom });
    }
    if (params.dateTo) {
      qb.andWhere('audit.created_at <= :dateTo', { dateTo: params.dateTo });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  findByTenant(tenantId: string): Promise<AuditLog[]> {
    return this.auditRepository
      .createQueryBuilder('audit')
      .where("audit.metadata ->> 'tenant' = :tenant", { tenant: tenantId })
      .orderBy('audit.created_at', 'DESC')
      .limit(200)
      .getMany();
  }

  async findRecentByActions(
    actions: string[],
    since: Date,
    limit = 50,
  ): Promise<AuditLog[]> {
    if (actions.length === 0) return [];
    return this.auditRepository
      .createQueryBuilder('audit')
      .where('audit.action IN (:...actions)', { actions })
      .andWhere('audit.created_at >= :since', { since: since.toISOString() })
      .orderBy('audit.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }
}

