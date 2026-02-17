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
};

@Injectable()
export class TenantIncomesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
    private readonly webhooksService: WebhooksService,
  ) {}

  async findAll(actor?: { sub?: string; role?: string }): Promise<TenantIncome[]> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantIncome,
    );
    return tenantRepo.withSchema(repo => {
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        return repo.find({ where: { driverId: actor.sub }, order: { loggedOn: 'DESC' } });
      }
      return repo.find({ order: { loggedOn: 'DESC' } });
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
    return tenantRepo.withSchema(async repo => {
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
        const { lastEndKm } = await this.getLastOdometer(payload.vehicle);
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
        startingKm: payload.startingKm ?? null,
        endKm: payload.endKm ?? null,
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
      });
      const saved = await repo.save(entity);
      await this.auditService.log({
        action: 'tenant.income.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
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

      const saved = await repo.save(existing);
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

  async remove(id: string) {
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
      await repo.remove(existing);
      await this.auditService.log({
        action: 'tenant.income.delete',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
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

  async approve(id: string, actor?: { sub?: string }): Promise<TenantIncome> {
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
      income.approvalStatus = 'approved';
      income.approvedAt = new Date();
      income.approvedBy = actor?.sub ?? null;
      const saved = await repo.save(income);
      await this.auditService.log({
        action: 'tenant.income.approve',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: id,
        metadata: { tenant: this.tenantContext.getTenantId(), vehicle: saved.vehicle },
      });
      return saved;
    });
  }

  async reject(id: string, actor?: { sub?: string }): Promise<TenantIncome> {
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
      income.approvalStatus = 'rejected';
      income.approvedAt = new Date();
      income.approvedBy = actor?.sub ?? null;
      const saved = await repo.save(income);
      await this.auditService.log({
        action: 'tenant.income.reject',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_income',
        targetId: id,
        metadata: { tenant: this.tenantContext.getTenantId(), vehicle: saved.vehicle },
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

