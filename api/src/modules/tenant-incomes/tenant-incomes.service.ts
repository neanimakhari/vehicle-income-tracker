import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantIncome } from './tenant-income.entity';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { TenantUser } from '../tenant-users/tenant-user.entity';
import { WebhooksService } from '../webhooks/webhooks.service';
import { TenantsService } from '../tenants/tenants.service';

type CreateIncomePayload = {
  vehicle: string;
  driverName: string;
  income: number;
  startingKm?: number;
  endKm?: number;
  petrolPoured?: number;
  petrolLitres?: number;
  expenseDetail?: string;
  expensePrice?: number;
  expenseImage?: string;
  petrolSlip?: string;
  driverId?: string;
  loggedOn: string;
  incomeStream?: string;
  tripId?: string;
  scholarPaymentId?: string;
};

export type MissingVehicleRow = {
  id: string;
  label: string;
  registrationNumber: string;
};

export type IncomeEventDto = {
  id: string;
  incomeId: string;
  action: string;
  reason: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  actorName: string | null;
  actorEmail: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

@Injectable()
export class TenantIncomesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
    private readonly webhooksService: WebhooksService,
    private readonly tenantsService: TenantsService,
  ) {}

  private snapshotIncome(income: TenantIncome): Record<string, unknown> {
    return {
      vehicle: income.vehicle,
      driverName: income.driverName,
      driverId: income.driverId,
      income: income.income != null ? Number(income.income) : null,
      startingKm: income.startingKm,
      endKm: income.endKm,
      petrolPoured: income.petrolPoured != null ? Number(income.petrolPoured) : null,
      petrolLitres: income.petrolLitres != null ? Number(income.petrolLitres) : null,
      expenseDetail: income.expenseDetail,
      expensePrice: income.expensePrice != null ? Number(income.expensePrice) : null,
      approvalStatus: income.approvalStatus,
      approvedAt: income.approvedAt?.toISOString?.() ?? income.approvedAt ?? null,
      approvedBy: income.approvedBy,
      incomeStream: income.incomeStream,
      loggedOn: income.loggedOn?.toISOString?.() ?? income.loggedOn ?? null,
    };
  }

  private async recordIncomeEvent(input: {
    incomeId: string;
    action: string;
    actorUserId?: string | null;
    actorRole?: string | null;
    reason?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }): Promise<void> {
    const schema = this.tenantScope.getTenantSchema();
    await this.dataSource.query(
      `INSERT INTO "${schema}"."income_events"
         (income_id, actor_user_id, actor_role, action, reason, before, after)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
      [
        input.incomeId,
        input.actorUserId ?? null,
        input.actorRole ?? null,
        input.action,
        input.reason ?? null,
        input.before != null ? JSON.stringify(input.before) : null,
        input.after != null ? JSON.stringify(input.after) : null,
      ],
    );
  }

  async getHistory(incomeId: string): Promise<IncomeEventDto[]> {
    const schema = this.tenantScope.getTenantSchema();
    const exists = await this.dataSource.query(
      `SELECT 1 FROM "${schema}"."vehicle_incomes" WHERE id = $1 LIMIT 1`,
      [incomeId],
    );
    if (!exists.length) throw new NotFoundException('Income not found');

    const rows = await this.dataSource.query(
      `SELECT e.id, e.income_id, e.actor_user_id, e.actor_role, e.action, e.reason,
              e.before, e.after, e.created_at,
              u.first_name AS driver_first, u.last_name AS driver_last, u.email AS driver_email,
              a.email AS admin_email
       FROM "${schema}"."income_events" e
       LEFT JOIN "${schema}"."users" u ON u.id = e.actor_user_id
       LEFT JOIN "platform"."auth_users" a ON a.id = e.actor_user_id
       WHERE e.income_id = $1
       ORDER BY e.created_at ASC`,
      [incomeId],
    );

    return (rows as Record<string, unknown>[]).map((r) => {
      const driverName =
        r.driver_first != null
          ? `${String(r.driver_first)} ${String(r.driver_last ?? '')}`.trim()
          : null;
      const actorEmail =
        r.driver_email != null
          ? String(r.driver_email)
          : r.admin_email != null
            ? String(r.admin_email)
            : null;
      let before: Record<string, unknown> | null = null;
      let after: Record<string, unknown> | null = null;
      if (r.before != null) {
        before =
          typeof r.before === 'string'
            ? (JSON.parse(r.before) as Record<string, unknown>)
            : (r.before as Record<string, unknown>);
      }
      if (r.after != null) {
        after =
          typeof r.after === 'string'
            ? (JSON.parse(r.after) as Record<string, unknown>)
            : (r.after as Record<string, unknown>);
      }
      const createdAt =
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at);
      return {
        id: String(r.id),
        incomeId: String(r.income_id),
        action: String(r.action),
        reason: r.reason != null ? String(r.reason) : null,
        actorUserId: r.actor_user_id != null ? String(r.actor_user_id) : null,
        actorRole: r.actor_role != null ? String(r.actor_role) : null,
        actorName: driverName || actorEmail,
        actorEmail,
        before,
        after,
        createdAt,
      };
    });
  }

  /**
   * Active vehicles with no income row for the given local day (tenant timezone).
   * Any logged row counts (including pending) — missing means nothing submitted.
   */
  async findMissingVehicles(date?: string): Promise<{
    date: string;
    timezone: string;
    missingCount: number;
    vehicles: MissingVehicleRow[];
  }> {
    const tenantSlug = this.tenantContext.getTenantId();
    if (!tenantSlug) {
      throw new BadRequestException('Tenant context missing');
    }
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    const timezone = tenant.missingIncomeTimezone || 'Africa/Johannesburg';
    const localDate =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date());

    const schema = this.tenantScope.getTenantSchema();
    const rows: Array<{
      id: string;
      label: string;
      registrationNumber: string;
    }> = await this.dataSource.query(
      `
      SELECT
        v.id,
        v.label,
        v.registration_number AS "registrationNumber"
      FROM "${schema}"."vehicles" v
      LEFT JOIN "${schema}"."vehicle_incomes" vi
        ON vi.vehicle = v.label
        AND DATE((vi.logged_on AT TIME ZONE 'UTC') AT TIME ZONE $1) = $2::date
      WHERE v.is_active = true
        AND vi.id IS NULL
      ORDER BY v.label ASC
      `,
      [timezone, localDate],
    );

    return {
      date: localDate,
      timezone,
      missingCount: rows.length,
      vehicles: rows.map((r) => ({
        id: String(r.id),
        label: String(r.label ?? ''),
        registrationNumber: String(r.registrationNumber ?? ''),
      })),
    };
  }

  async findAll(actor?: { sub?: string; role?: string }): Promise<TenantIncome[]> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(repo => {
      // Omit base64 slips/images from list — detail endpoint still returns full rows.
      const opts = {
        order: { loggedOn: 'DESC' as const },
        select: {
          id: true,
          vehicle: true,
          driverName: true,
          income: true,
          startingKm: true,
          endKm: true,
          petrolPoured: true,
          petrolLitres: true,
          expenseDetail: true,
          expensePrice: true,
          driverId: true,
          loggedOn: true,
          approvalStatus: true,
          approvedAt: true,
          approvedBy: true,
          incomeStream: true,
          tripId: true,
          scholarPaymentId: true,
          createdAt: true,
          updatedAt: true,
        },
      };
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        return repo.find({ ...opts, where: { driverId: actor.sub } });
      }
      return repo.find(opts);
    });
  }

  async findOne(id: string, actor?: { sub?: string; role?: string }): Promise<TenantIncome> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(async repo => {
      const income = await repo.findOne({ where: { id } });
      if (!income) {
        throw new NotFoundException('Income not found');
      }
      if (actor?.role === 'TENANT_USER' && actor.sub && income.driverId !== actor.sub) {
        throw new NotFoundException('Income not found');
      }
      return income;
    });
  }

  async findAllPaginated(
    actor: { sub?: string; role?: string } | undefined,
    page: number,
    limit: number,
    status?: 'pending',
  ): Promise<{ data: TenantIncome[]; total: number; page: number; limit: number }> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(async repo => {
      const qb = repo
        .createQueryBuilder('income')
        .select([
          'income.id',
          'income.vehicle',
          'income.driverName',
          'income.income',
          'income.startingKm',
          'income.endKm',
          'income.petrolPoured',
          'income.petrolLitres',
          'income.expenseDetail',
          'income.expensePrice',
          'income.driverId',
          'income.loggedOn',
          'income.approvalStatus',
          'income.approvedAt',
          'income.approvedBy',
          'income.incomeStream',
          'income.tripId',
          'income.scholarPaymentId',
          'income.createdAt',
          'income.updatedAt',
        ])
        .orderBy('income.logged_on', 'DESC')
        .skip((pageNum - 1) * limitNum)
        .take(limitNum);
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        qb.andWhere('income.driverId = :driverId', { driverId: actor.sub });
      }
      if (status === 'pending') {
        qb.andWhere('income.approvalStatus = :status', { status: 'pending' });
      }
      const [data, total] = await qb.getManyAndCount();
      return { data, total, page: pageNum, limit: limitNum };
    });
  }

  async getLastOdometer(vehicle: string): Promise<{ lastEndKm: number | null; lastLoggedOn: string | null }> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(async repo => {
      const last = await repo
        .createQueryBuilder('income')
        .select(['income.endKm', 'income.loggedOn'])
        .where('income.vehicle = :vehicle', { vehicle })
        .orderBy('income.logged_on', 'DESC')
        .getOne();
      if (!last) return { lastEndKm: null, lastLoggedOn: null };
      const endKm = last.endKm != null ? Number(last.endKm) : null;
      return {
        lastEndKm: endKm,
        lastLoggedOn: last.loggedOn ? new Date(last.loggedOn).toISOString() : null,
      };
    });
  }

  async create(
    payload: CreateIncomePayload,
    actor?: { sub?: string; role?: string },
  ): Promise<TenantIncome> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    try {
      return await tenantRepo.withSchema(async repo => {
      let driverName = payload.driverName;
      let driverId = payload.driverId ?? null;
      
      // If driverId is provided (admin creating on behalf of driver), get driver name
      if (driverId && actor?.role === 'TENANT_ADMIN') {
        const user = await userRepo.withSchema(userRepository =>
          userRepository.findOne({ where: { id: driverId as string } }),
        );
        if (user) {
          driverName = `${user.firstName} ${user.lastName}`;
        }
      }
      
      // If driver is creating their own income
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        const user = await userRepo.withSchema(userRepository =>
          userRepository.findOne({ where: { id: actor.sub } }),
        );
        if (!user || !user.isActive) {
          throw new UnauthorizedException('User not allowed');
        }
        driverId = user.id;
        driverName = `${user.firstName} ${user.lastName}`;
      }

      const loggedOnDate = new Date(payload.loggedOn);
      const now = new Date();
      const isToday =
        loggedOnDate.getUTCFullYear() === now.getUTCFullYear() &&
        loggedOnDate.getUTCMonth() === now.getUTCMonth() &&
        loggedOnDate.getUTCDate() === now.getUTCDate();
      const approvalStatus: 'auto' | 'pending' = isToday ? 'auto' : 'pending';

      if (payload.vehicle && payload.endKm != null) {
        const last = await repo
          .createQueryBuilder('income')
          .select(['income.endKm', 'income.loggedOn'])
          .where('income.vehicle = :vehicle', { vehicle: payload.vehicle })
          .orderBy('income.logged_on', 'DESC')
          .getOne();
        const lastEndKm = last?.endKm != null ? Number(last.endKm) : null;
        if (lastEndKm != null && Number(payload.endKm) < lastEndKm) {
          throw new BadRequestException(
            `End KM cannot be less than the last recorded end KM for this vehicle (${lastEndKm}).`,
          );
        }
        if (payload.startingKm != null && Number(payload.endKm) < Number(payload.startingKm)) {
          throw new BadRequestException('End KM cannot be less than starting KM.');
        }
      }

      const entity = repo.create({
        vehicle: payload.vehicle,
        driverName,
        income: payload.income,
        startingKm: payload.startingKm != null ? Math.round(Number(payload.startingKm)) : null,
        endKm: payload.endKm != null ? Math.round(Number(payload.endKm)) : null,
        petrolPoured: payload.petrolPoured ?? null,
        petrolLitres: payload.petrolLitres ?? null,
        expenseDetail: payload.expenseDetail ?? null,
        expensePrice: payload.expensePrice ?? null,
        expenseImage: payload.expenseImage ?? null,
        petrolSlip: payload.petrolSlip ?? null,
        driverId,
        loggedOn: loggedOnDate,
        approvalStatus,
        approvedAt: null,
        approvedBy: null,
        incomeStream: payload.incomeStream ?? 'general',
        tripId: payload.tripId ?? null,
        scholarPaymentId: payload.scholarPaymentId ?? null,
      });
      const saved = await repo.save(entity);
      await this.recordIncomeEvent({
        incomeId: saved.id,
        action: 'create',
        actorUserId: actor?.sub ?? null,
        actorRole: actor?.role ?? null,
        after: this.snapshotIncome(saved),
      });
      await this.auditService.log({
        action: 'tenant.income.create',
        actorUserId: actor?.sub ?? null,
        actorRole: actor?.role ?? 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          vehicle: saved.vehicle,
          income: saved.income,
        },
      });
      void this.webhooksService.dispatch('income.created', {
        id: saved.id,
        vehicle: saved.vehicle,
        driverName: saved.driverName,
        income: Number(saved.income),
        loggedOn: saved.loggedOn.toISOString(),
      });
      return saved;
    });
    } catch (err) {
      console.error('[TenantIncomesService.create]', err);
      throw err;
    }
  }

  async update(
    id: string,
    payload: Partial<CreateIncomePayload>,
    actor?: { sub?: string; role?: string },
  ): Promise<TenantIncome> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Income not found');
      }

      const before = this.snapshotIncome(existing);

      // If driverId is provided, update driverName from user
      if (payload.driverId) {
        const user = await userRepo.withSchema(userRepository =>
          userRepository.findOne({ where: { id: payload.driverId } }),
        );
        if (user) {
          existing.driverName = `${user.firstName} ${user.lastName}`;
          existing.driverId = user.id;
        }
      } else if (payload.driverName) {
        existing.driverName = payload.driverName;
      }

      if (payload.vehicle !== undefined) existing.vehicle = payload.vehicle;
      if (payload.income !== undefined) existing.income = payload.income;
      if (payload.startingKm !== undefined) existing.startingKm = payload.startingKm ?? null;
      if (payload.endKm !== undefined) existing.endKm = payload.endKm ?? null;
      if (payload.petrolPoured !== undefined) existing.petrolPoured = payload.petrolPoured ?? null;
      if (payload.petrolLitres !== undefined) existing.petrolLitres = payload.petrolLitres ?? null;
      if (payload.expenseDetail !== undefined) existing.expenseDetail = payload.expenseDetail ?? null;
      if (payload.expensePrice !== undefined) existing.expensePrice = payload.expensePrice ?? null;
      if (payload.expenseImage !== undefined) existing.expenseImage = payload.expenseImage ?? null;
      if (payload.petrolSlip !== undefined) existing.petrolSlip = payload.petrolSlip ?? null;
      if (payload.loggedOn !== undefined) existing.loggedOn = new Date(payload.loggedOn);
      if (payload.incomeStream !== undefined) existing.incomeStream = payload.incomeStream;
      if (payload.tripId !== undefined) existing.tripId = payload.tripId ?? null;
      if (payload.scholarPaymentId !== undefined)
        existing.scholarPaymentId = payload.scholarPaymentId ?? null;

      const saved = await repo.save(existing);
      await this.recordIncomeEvent({
        incomeId: saved.id,
        action: 'update',
        actorUserId: actor?.sub ?? null,
        actorRole: actor?.role ?? 'TENANT_ADMIN',
        before,
        after: this.snapshotIncome(saved),
      });
      await this.auditService.log({
        action: 'tenant.income.update',
        actorUserId: actor?.sub ?? null,
        actorRole: actor?.role ?? 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          vehicle: saved.vehicle,
          income: saved.income,
        },
      });
      return saved;
    });
  }

  async remove(id: string, actor?: { sub?: string; role?: string }) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Income not found');
      }
      const before = this.snapshotIncome(existing);
      await this.recordIncomeEvent({
        incomeId: existing.id,
        action: 'delete',
        actorUserId: actor?.sub ?? null,
        actorRole: actor?.role ?? 'TENANT_ADMIN',
        before,
      });
      await repo.remove(existing);
      await this.auditService.log({
        action: 'tenant.income.delete',
        actorUserId: actor?.sub ?? null,
        actorRole: actor?.role ?? 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          vehicle: existing.vehicle,
          income: existing.income,
        },
      });
      return { deleted: true };
    });
  }

  async approve(
    id: string,
    actor?: { sub?: string },
    reason?: string | null,
  ): Promise<TenantIncome> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(async repo => {
      const income = await repo.findOne({ where: { id } });
      if (!income) throw new NotFoundException('Income not found');
      if (income.approvalStatus !== 'pending') {
        throw new BadRequestException('Only pending incomes can be approved.');
      }
      const before = this.snapshotIncome(income);
      income.approvalStatus = 'approved';
      income.approvedAt = new Date();
      income.approvedBy = actor?.sub ?? null;
      const saved = await repo.save(income);
      await this.recordIncomeEvent({
        incomeId: saved.id,
        action: 'approve',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        reason: reason?.trim() || null,
        before,
        after: this.snapshotIncome(saved),
      });
      await this.auditService.log({
        action: 'tenant.income.approve',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          vehicle: saved.vehicle,
          reason: reason?.trim() || null,
        },
      });
      return saved;
    });
  }

  async reject(
    id: string,
    actor?: { sub?: string },
    reason?: string | null,
  ): Promise<TenantIncome> {
    const trimmed = reason?.trim() || '';
    if (!trimmed) {
      throw new BadRequestException('A reject reason is required.');
    }
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(async repo => {
      const income = await repo.findOne({ where: { id } });
      if (!income) throw new NotFoundException('Income not found');
      if (income.approvalStatus !== 'pending') {
        throw new BadRequestException('Only pending incomes can be rejected.');
      }
      const before = this.snapshotIncome(income);
      income.approvalStatus = 'rejected';
      income.approvedAt = new Date();
      income.approvedBy = actor?.sub ?? null;
      const saved = await repo.save(income);
      await this.recordIncomeEvent({
        incomeId: saved.id,
        action: 'reject',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        reason: trimmed,
        before,
        after: this.snapshotIncome(saved),
      });
      await this.auditService.log({
        action: 'tenant.income.reject',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          vehicle: saved.vehicle,
          reason: trimmed,
        },
      });
      return saved;
    });
  }

  async seedDummyData(actor: { sub: string; role?: string }): Promise<{ created: number }> {
    if (!actor.sub) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantUser,
    );
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );

    // Get the current user
    const user = await userRepo.withSchema(repo =>
      repo.findOne({ where: { id: actor.sub } }),
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const driverName = `${user.firstName} ${user.lastName}`;
    const driverId = user.id;

    // Get available vehicles from the vehicles table
    const schemaName = this.tenantScope.getTenantSchema();
    const vehiclesResult = await this.dataSource.query(
      `SELECT label FROM "${schemaName}"."vehicles" WHERE is_active = true LIMIT 10`,
    );
    const vehicleLabels = vehiclesResult.map((v: { label: string }) => v.label);

    // If no vehicles exist, use default vehicle names
    const defaultVehicles = ['Taxi 1', 'Taxi 2', 'Vehicle A', 'Vehicle B'];
    const availableVehicles = vehicleLabels.length > 0 ? vehicleLabels : defaultVehicles;

    // Generate dummy data for the last 30 days
    const now = new Date();
    const incomesToCreate: Array<{
      vehicle: string;
      driverName: string;
      income: number;
      startingKm: number | null;
      endKm: number | null;
      petrolPoured: number | null;
      petrolLitres: number | null;
      expenseDetail: string | null;
      expensePrice: number | null;
      expenseImage: string | null;
      petrolSlip: string | null;
      driverId: string;
      loggedOn: Date;
    }> = [];

    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Skip weekends randomly (70% chance of having income on weekdays)
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (Math.random() > 0.3) continue; // Skip most weekends
      }

      // Random vehicle
      const vehicle = availableVehicles[Math.floor(Math.random() * availableVehicles.length)];

      // Random income between 200 and 1500
      const income = Math.floor(Math.random() * 1300) + 200;

      // Random starting KM (incrementing from previous day)
      const baseKm = 50000 + (30 - i) * 50;
      const startingKm = baseKm + Math.floor(Math.random() * 20);
      const endKm = startingKm + Math.floor(Math.random() * 100) + 20;

      // Random petrol data (50% chance)
      const hasPetrol = Math.random() > 0.5;
      const petrolPoured = hasPetrol ? Math.floor(Math.random() * 500) + 100 : null;
      const petrolLitres = hasPetrol ? Math.floor(Math.random() * 30) + 10 : null;

      // Random expense (30% chance)
      const hasExpense = Math.random() > 0.7;
      const expenseDetails = [
        'Tire repair',
        'Oil change',
        'Car wash',
        'Parking fee',
        'Toll fee',
        'Breakfast',
        'Lunch',
      ];
      const expenseDetail = hasExpense
        ? expenseDetails[Math.floor(Math.random() * expenseDetails.length)]
        : null;
      const expensePrice = hasExpense ? Math.floor(Math.random() * 200) + 20 : null;

      incomesToCreate.push({
        vehicle,
        driverName,
        income,
        startingKm,
        endKm,
        petrolPoured,
        petrolLitres,
        expenseDetail,
        expensePrice,
        expenseImage: null,
        petrolSlip: null,
        driverId,
        loggedOn: date,
      });
    }

    // Save all incomes
    let created = 0;
    await tenantRepo.withSchema(async repo => {
      for (const incomeData of incomesToCreate) {
        try {
          const incomeEntity = repo.create(incomeData);
          await repo.save(incomeEntity);
          created++;
        } catch (error) {
          // Skip duplicates or errors
          console.error('Error seeding income:', error);
        }
      }
    });

    await this.auditService.log({
      action: 'tenant.income.seed',
      actorUserId: actor.sub,
      actorRole: actor.role ?? 'TENANT_USER',
      targetType: 'tenant_income',
      targetId: null,
      metadata: {
        tenant: this.tenantContext.getTenantId(),
        driverId,
        created,
      },
    });

    return { created };
  }
}

