import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { randomUUID } from 'crypto';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { TenantIncome } from '../tenant-incomes/tenant-income.entity';
import { TenantVehicle } from '../tenant-vehicles/tenant-vehicle.entity';
import { TransportGroup } from './transport-group.entity';
import { TransportPassenger } from './transport-passenger.entity';
import { TransportAssignment } from './transport-assignment.entity';
import { TransportFeePause } from './transport-fee-pause.entity';
import { TransportBillingPeriod } from './transport-billing-period.entity';
import { TransportPaymentClaim } from './transport-payment-claim.entity';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function monthRange(anchor: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  return { start, end };
}

function weekRange(anchor: Date): { start: Date; end: Date } {
  const day = anchor.getUTCDay();
  const start = addDays(anchor, -((day + 6) % 7)); // Monday
  const end = addDays(start, 6);
  return { start, end };
}

function yearRange(anchor: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), 11, 31));
  return { start, end };
}

@Injectable()
export class TenantTransportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly tenantContext: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  private groups() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TransportGroup);
  }
  private passengers() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TransportPassenger);
  }
  private assignments() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TransportAssignment);
  }
  private pauses() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TransportFeePause);
  }
  private periods() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TransportBillingPeriod);
  }
  private claims() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TransportPaymentClaim);
  }
  private vehicles() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TenantVehicle);
  }
  private incomes() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TenantIncome);
  }

  // --- Groups ---
  listGroups() {
    return this.groups().withSchema((repo) =>
      repo.find({ order: { name: 'ASC' } }),
    );
  }

  async createGroup(payload: Partial<TransportGroup>) {
    if (!payload.name?.trim()) throw new BadRequestException('name required');
    return this.groups().withSchema(async (repo) => {
      const saved = await repo.save(
        repo.create({
          name: payload.name!.trim(),
          kind: payload.kind ?? 'school',
          defaultAmount: Number(payload.defaultAmount ?? 0),
          cadence: payload.cadence ?? 'monthly',
          dueDay: payload.dueDay ?? null,
          graceDays: payload.graceDays ?? 7,
          notes: payload.notes ?? null,
          isActive: payload.isActive ?? true,
        }),
      );
      await this.auditService.log({
        action: 'tenant.transport.group.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'transport_group',
        targetId: saved.id,
        metadata: { tenant: this.tenantContext.getTenantId(), name: saved.name },
      });
      return saved;
    });
  }

  async updateGroup(id: string, payload: Partial<TransportGroup>) {
    return this.groups().withSchema(async (repo) => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Group not found');
      if (payload.name !== undefined) existing.name = payload.name.trim();
      if (payload.kind !== undefined) existing.kind = payload.kind;
      if (payload.defaultAmount !== undefined)
        existing.defaultAmount = Number(payload.defaultAmount);
      if (payload.cadence !== undefined) existing.cadence = payload.cadence;
      if (payload.dueDay !== undefined) existing.dueDay = payload.dueDay;
      if (payload.graceDays !== undefined) existing.graceDays = payload.graceDays;
      if (payload.notes !== undefined) existing.notes = payload.notes;
      if (payload.isActive !== undefined) existing.isActive = payload.isActive;
      return repo.save(existing);
    });
  }

  async deleteGroup(id: string) {
    return this.groups().withSchema(async (repo) => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Group not found');
      await repo.remove(existing);
      return { deleted: true };
    });
  }

  // --- Fee pauses ---
  listPauses() {
    return this.pauses().withSchema((repo) =>
      repo.find({ order: { startDate: 'DESC' } }),
    );
  }

  createPause(payload: { label: string; startDate: string; endDate: string }) {
    if (!payload.label?.trim()) throw new BadRequestException('label required');
    parseDate(payload.startDate);
    parseDate(payload.endDate);
    return this.pauses().withSchema((repo) =>
      repo.save(
        repo.create({
          label: payload.label.trim(),
          startDate: payload.startDate,
          endDate: payload.endDate,
        }),
      ),
    );
  }

  async deletePause(id: string) {
    return this.pauses().withSchema(async (repo) => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Pause not found');
      await repo.remove(existing);
      return { deleted: true };
    });
  }

  // --- Passengers ---
  async listPassengers(filters?: {
    vehicleId?: string;
    groupId?: string;
    activeOnly?: boolean;
  }) {
    return this.passengers().withSchema(async (repo) => {
      const qb = repo.createQueryBuilder('p').orderBy('p.name', 'ASC');
      if (filters?.vehicleId)
        qb.andWhere('p.vehicle_id = :vehicleId', { vehicleId: filters.vehicleId });
      if (filters?.groupId)
        qb.andWhere('p.group_id = :groupId', { groupId: filters.groupId });
      if (filters?.activeOnly !== false)
        qb.andWhere('p.is_active = true');
      return qb.getMany();
    });
  }

  private async seatCapacityWarning(vehicleId: string | null | undefined) {
    if (!vehicleId) return null;
    return this.vehicles().withSchema(async (vRepo) => {
      const vehicle = await vRepo.findOne({ where: { id: vehicleId } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      const capacity = (vehicle as TenantVehicle & { seatCapacity?: number | null })
        .seatCapacity;
      if (capacity == null) return null;
      const count = await this.passengers().withSchema((pRepo) =>
        pRepo.count({ where: { vehicleId, isActive: true } }),
      );
      if (count >= Number(capacity)) {
        return {
          warning: `Vehicle ${vehicle.registrationNumber} has ${count} active passengers vs seat capacity ${capacity}`,
          count,
          capacity: Number(capacity),
        };
      }
      return null;
    });
  }

  async createPassenger(payload: {
    type?: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
    notes?: string | null;
    householdId?: string | null;
    groupId?: string | null;
    vehicleId?: string | null;
    driverUserId?: string | null;
    feeAmount?: number | null;
    feeCadence?: string | null;
    isActive?: boolean;
  }) {
    if (!payload.name?.trim()) throw new BadRequestException('name required');
    if (payload.isActive !== false && !payload.vehicleId) {
      throw new BadRequestException('vehicleId required for active passengers');
    }
    const seatWarn = await this.seatCapacityWarning(payload.vehicleId);
    return this.passengers().withSchema(async (repo) => {
      const saved = await repo.save(
        repo.create({
          type: payload.type ?? 'scholar',
          name: payload.name.trim(),
          contactName: payload.contactName ?? null,
          phone: payload.phone ?? null,
          notes: payload.notes ?? null,
          householdId: payload.householdId ?? null,
          groupId: payload.groupId ?? null,
          vehicleId: payload.vehicleId ?? null,
          driverUserId: payload.driverUserId ?? null,
          feeAmount: payload.feeAmount != null ? Number(payload.feeAmount) : null,
          feeCadence: payload.feeCadence ?? null,
          isActive: payload.isActive ?? true,
        }),
      );
      if (saved.vehicleId) {
        await this.assignments().withSchema((aRepo) =>
          aRepo.save(
            aRepo.create({
              passengerId: saved.id,
              vehicleId: saved.vehicleId!,
              driverUserId: saved.driverUserId,
              effectiveFrom: ymd(new Date()),
              effectiveTo: null,
              notes: 'Initial assignment',
            }),
          ),
        );
      }
      await this.auditService.log({
        action: 'tenant.transport.passenger.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'transport_passenger',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          name: saved.name,
          vehicleId: saved.vehicleId,
        },
      });
      return { passenger: saved, seatWarning: seatWarn };
    });
  }

  async updatePassenger(
    id: string,
    payload: Partial<{
      type: string;
      name: string;
      contactName: string | null;
      phone: string | null;
      notes: string | null;
      householdId: string | null;
      groupId: string | null;
      vehicleId: string | null;
      driverUserId: string | null;
      feeAmount: number | null;
      feeCadence: string | null;
      isActive: boolean;
    }>,
  ) {
    return this.passengers().withSchema(async (repo) => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Passenger not found');
      const prevVehicle = existing.vehicleId;
      if (payload.type !== undefined) existing.type = payload.type;
      if (payload.name !== undefined) existing.name = payload.name.trim();
      if (payload.contactName !== undefined) existing.contactName = payload.contactName;
      if (payload.phone !== undefined) existing.phone = payload.phone;
      if (payload.notes !== undefined) existing.notes = payload.notes;
      if (payload.householdId !== undefined) existing.householdId = payload.householdId;
      if (payload.groupId !== undefined) existing.groupId = payload.groupId;
      if (payload.vehicleId !== undefined) existing.vehicleId = payload.vehicleId;
      if (payload.driverUserId !== undefined)
        existing.driverUserId = payload.driverUserId;
      if (payload.feeAmount !== undefined)
        existing.feeAmount =
          payload.feeAmount != null ? Number(payload.feeAmount) : null;
      if (payload.feeCadence !== undefined) existing.feeCadence = payload.feeCadence;
      if (payload.isActive !== undefined) existing.isActive = payload.isActive;
      if (existing.isActive && !existing.vehicleId) {
        throw new BadRequestException('vehicleId required for active passengers');
      }
      const saved = await repo.save(existing);
      if (payload.vehicleId !== undefined && payload.vehicleId !== prevVehicle) {
        await this.assignments().withSchema(async (aRepo) => {
          if (prevVehicle) {
            const open = await aRepo.find({
              where: { passengerId: id, effectiveTo: IsNull() },
            });
            for (const row of open) {
              row.effectiveTo = ymd(new Date());
              await aRepo.save(row);
            }
          }
          if (saved.vehicleId) {
            await aRepo.save(
              aRepo.create({
                passengerId: saved.id,
                vehicleId: saved.vehicleId,
                driverUserId: saved.driverUserId,
                effectiveFrom: ymd(new Date()),
                effectiveTo: null,
                notes: 'Vehicle move',
              }),
            );
          }
        });
      }
      const seatWarn = await this.seatCapacityWarning(saved.vehicleId);
      return { passenger: saved, seatWarning: seatWarn };
    });
  }

  async importPassengers(
    rows: Array<{
      name: string;
      type?: string;
      vehicleReg?: string;
      groupName?: string;
      feeAmount?: number;
      cadence?: string;
      contactName?: string;
      phone?: string;
      driverEmail?: string;
    }>,
  ) {
    const vehicles = await this.vehicles().withSchema((repo) => repo.find());
    const byReg = new Map(
      vehicles.map((v) => [v.registrationNumber.toUpperCase().replace(/\s+/g, ''), v]),
    );
    const groups = await this.listGroups();
    const byGroup = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
    const created: TransportPassenger[] = [];
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name?.trim()) {
        errors.push(`Row ${i + 1}: name required`);
        continue;
      }
      let vehicleId: string | null = null;
      if (row.vehicleReg?.trim()) {
        const key = row.vehicleReg.toUpperCase().replace(/\s+/g, '');
        const v = byReg.get(key);
        if (!v) {
          errors.push(`Row ${i + 1}: vehicle ${row.vehicleReg} not found`);
          continue;
        }
        vehicleId = v.id;
      }
      let groupId: string | null = null;
      if (row.groupName?.trim()) {
        const existing = byGroup.get(row.groupName.toLowerCase());
        if (existing) groupId = existing.id;
        else {
          const g = await this.createGroup({
            name: row.groupName.trim(),
            kind: 'school',
            defaultAmount: row.feeAmount ?? 0,
            cadence: row.cadence ?? 'monthly',
          });
          byGroup.set(g.name.toLowerCase(), g);
          groupId = g.id;
        }
      }
      try {
        const result = await this.createPassenger({
          name: row.name,
          type: row.type ?? 'scholar',
          vehicleId,
          groupId,
          feeAmount: row.feeAmount ?? null,
          feeCadence: row.cadence ?? null,
          contactName: row.contactName ?? null,
          phone: row.phone ?? null,
          isActive: Boolean(vehicleId),
        });
        created.push(result.passenger);
      } catch (e) {
        errors.push(`Row ${i + 1}: ${(e as Error).message}`);
      }
    }
    return { created: created.length, errors, passengers: created };
  }

  // --- Billing / arrears ---
  private async resolveFee(passenger: TransportPassenger, group: TransportGroup | null) {
    const amount =
      passenger.feeAmount != null
        ? Number(passenger.feeAmount)
        : Number(group?.defaultAmount ?? 0);
    const cadence = passenger.feeCadence ?? group?.cadence ?? 'monthly';
    const graceDays = group?.graceDays ?? 7;
    const dueDay = group?.dueDay ?? 1;
    return { amount, cadence, graceDays, dueDay };
  }

  private periodBounds(cadence: string, anchor: Date) {
    if (cadence === 'weekly') return weekRange(anchor);
    if (cadence === 'annual') return yearRange(anchor);
    return monthRange(anchor);
  }

  private async isPaused(start: string, end: string): Promise<boolean> {
    const pauses = await this.listPauses();
    return pauses.some((p) => p.startDate <= end && p.endDate >= start);
  }

  async ensurePeriodsForAnchor(anchorDate?: string) {
    const anchor = anchorDate ? parseDate(anchorDate) : new Date();
    const passengers = await this.listPassengers({ activeOnly: true });
    const groups = await this.listGroups();
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const out: TransportBillingPeriod[] = [];
    for (const p of passengers) {
      const group = p.groupId ? groupMap.get(p.groupId) ?? null : null;
      const fee = await this.resolveFee(p, group);
      const { start, end } = this.periodBounds(fee.cadence, anchor);
      const startS = ymd(start);
      const endS = ymd(end);
      if (await this.isPaused(startS, endS)) continue;
      if (fee.amount <= 0) continue;
      const due =
        fee.cadence === 'monthly'
          ? ymd(
              new Date(
                Date.UTC(
                  start.getUTCFullYear(),
                  start.getUTCMonth(),
                  Math.min(fee.dueDay, end.getUTCDate()),
                ),
              ),
            )
          : startS;
      const period = await this.periods().withSchema(async (repo) => {
        const existing = await repo.findOne({
          where: {
            passengerId: p.id,
            periodStart: startS,
            periodEnd: endS,
          },
        });
        if (existing) {
          existing.expectedAmount = fee.amount;
          existing.dueDate = due;
          existing.cadence = fee.cadence;
          return repo.save(existing);
        }
        return repo.save(
          repo.create({
            passengerId: p.id,
            periodStart: startS,
            periodEnd: endS,
            cadence: fee.cadence,
            expectedAmount: fee.amount,
            dueDate: due,
          }),
        );
      });
      out.push(period);
    }
    return out;
  }

  async getArrears(opts?: { from?: string; to?: string; anchor?: string }) {
    const periods = await this.ensurePeriodsForAnchor(opts?.anchor);
    const filtered = periods.filter((p) => {
      if (opts?.from && p.periodEnd < opts.from) return false;
      if (opts?.to && p.periodStart > opts.to) return false;
      return true;
    });
    const passengers = await this.listPassengers({ activeOnly: false });
    const pMap = new Map(passengers.map((p) => [p.id, p]));
    const groups = await this.listGroups();
    const gMap = new Map(groups.map((g) => [g.id, g]));
    const claims = await this.claims().withSchema((repo) =>
      repo.find({ where: { status: 'approved' } }),
    );
    const paidByPeriod = new Map<string, number>();
    for (const c of claims) {
      if (!c.billingPeriodId) continue;
      paidByPeriod.set(
        c.billingPeriodId,
        (paidByPeriod.get(c.billingPeriodId) ?? 0) + Number(c.amount),
      );
    }
    const today = ymd(new Date());
    return filtered.map((period) => {
      const passenger = pMap.get(period.passengerId);
      const group = passenger?.groupId ? gMap.get(passenger.groupId) : null;
      const paid = paidByPeriod.get(period.id) ?? 0;
      const expected = Number(period.expectedAmount);
      const balance = Math.max(0, expected - paid);
      const graceDays = group?.graceDays ?? 7;
      const due = period.dueDate ?? period.periodStart;
      const graceEnd = ymd(addDays(parseDate(due), graceDays));
      let status: 'paid' | 'partial' | 'pending' | 'overdue' | 'paused' = 'pending';
      if (paid >= expected && expected > 0) status = 'paid';
      else if (paid > 0 && paid < expected) status = 'partial';
      else if (balance > 0 && today > graceEnd) status = 'overdue';
      return {
        periodId: period.id,
        passengerId: period.passengerId,
        passengerName: passenger?.name ?? 'Unknown',
        passengerType: passenger?.type ?? 'scholar',
        vehicleId: passenger?.vehicleId ?? null,
        groupId: passenger?.groupId ?? null,
        groupName: group?.name ?? null,
        householdId: passenger?.householdId ?? null,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        expected,
        paid,
        balance,
        dueDate: due,
        graceEnd,
        status,
      };
    });
  }

  // --- Payments ---
  listClaims(status?: string) {
    return this.claims().withSchema((repo) => {
      if (status) return repo.find({ where: { status }, order: { createdAt: 'DESC' } });
      return repo.find({ order: { createdAt: 'DESC' } });
    });
  }

  /** Passengers this driver may collect for: assigned to them, or unassigned. */
  async listPassengersForDriver(driverUserId: string) {
    if (!driverUserId) throw new BadRequestException('driver required');
    return this.passengers().withSchema(async (repo) => {
      return repo
        .createQueryBuilder('p')
        .where('p.is_active = true')
        .andWhere(
          '(p.driver_user_id = :driverUserId OR p.driver_user_id IS NULL)',
          { driverUserId },
        )
        .orderBy('p.name', 'ASC')
        .getMany();
    });
  }

  /** Claims submitted or collected by this driver. */
  async listClaimsForDriver(driverUserId: string, status?: string) {
    if (!driverUserId) throw new BadRequestException('driver required');
    return this.claims().withSchema(async (repo) => {
      const qb = repo
        .createQueryBuilder('c')
        .where(
          '(c.submitted_by_user_id = :driverUserId OR c.collected_by_driver_id = :driverUserId)',
          { driverUserId },
        )
        .orderBy('c.created_at', 'DESC');
      if (status) qb.andWhere('c.status = :status', { status });
      return qb.getMany();
    });
  }

  async createDriverClaim(
    payload: {
      passengerId: string;
      billingPeriodId?: string | null;
      amount: number;
      method?: string;
      paidAt?: string;
      notes?: string | null;
    },
    actor: { sub?: string },
  ) {
    if (!actor?.sub) throw new BadRequestException('Not authenticated');
    const passenger = await this.passengers().withSchema((repo) =>
      repo.findOne({ where: { id: payload.passengerId } }),
    );
    if (!passenger) throw new NotFoundException('Passenger not found');
    if (!passenger.isActive) {
      throw new BadRequestException('Passenger is inactive');
    }
    if (passenger.driverUserId && passenger.driverUserId !== actor.sub) {
      throw new ForbiddenException('Passenger is not assigned to you');
    }
    return this.createClaim(
      {
        ...payload,
        collectedByDriverId: actor.sub,
        autoApprove: false,
      },
      actor,
    );
  }

  async createClaim(
    payload: {
      passengerId: string;
      billingPeriodId?: string | null;
      amount: number;
      method?: string;
      paidAt?: string;
      notes?: string | null;
      collectedByDriverId?: string | null;
      autoApprove?: boolean;
    },
    actor?: { sub?: string },
  ) {
    if (!payload.passengerId) throw new BadRequestException('passengerId required');
    if (!(Number(payload.amount) > 0)) throw new BadRequestException('amount must be > 0');
    const passenger = await this.passengers().withSchema((repo) =>
      repo.findOne({ where: { id: payload.passengerId } }),
    );
    if (!passenger) throw new NotFoundException('Passenger not found');

    let billingPeriodId = payload.billingPeriodId ?? null;
    if (!billingPeriodId) {
      const ensured = await this.ensurePeriodsForAnchor(
        payload.paidAt ? ymd(new Date(payload.paidAt)) : undefined,
      );
      const match = ensured.find((p) => p.passengerId === passenger.id);
      billingPeriodId = match?.id ?? null;
    }

    const claim = await this.claims().withSchema((repo) =>
      repo.save(
        repo.create({
          passengerId: passenger.id,
          billingPeriodId,
          vehicleId: passenger.vehicleId,
          amount: Number(payload.amount),
          method: payload.method ?? 'cash',
          paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
          status: 'pending',
          notes: payload.notes ?? null,
          submittedByUserId: actor?.sub ?? null,
          collectedByDriverId: payload.collectedByDriverId ?? null,
        }),
      ),
    );

    if (payload.autoApprove && !payload.collectedByDriverId) {
      return this.approveClaim(claim.id, actor);
    }
    await this.auditService.log({
      action: 'tenant.transport.payment.create',
      actorUserId: actor?.sub ?? null,
      actorRole: 'TENANT_ADMIN',
      targetType: 'transport_payment_claim',
      targetId: claim.id,
      metadata: {
        tenant: this.tenantContext.getTenantId(),
        amount: claim.amount,
        passengerId: claim.passengerId,
      },
    });
    return claim;
  }

  async approveClaim(id: string, actor?: { sub?: string }) {
    return this.claims().withSchema(async (cRepo) => {
      const claim = await cRepo.findOne({ where: { id } });
      if (!claim) throw new NotFoundException('Payment claim not found');
      if (claim.status === 'approved') return claim;
      if (claim.status === 'rejected') {
        throw new BadRequestException('Cannot approve a rejected claim');
      }

      const passenger = await this.passengers().withSchema((repo) =>
        repo.findOne({ where: { id: claim.passengerId } }),
      );
      if (!passenger) throw new NotFoundException('Passenger not found');

      const vehicle = claim.vehicleId
        ? await this.vehicles().withSchema((repo) =>
            repo.findOne({ where: { id: claim.vehicleId! } }),
          )
        : null;

      const income = await this.incomes().withSchema(async (repo) => {
        const entity = repo.create({
          vehicle: vehicle?.registrationNumber ?? vehicle?.label ?? 'TRANSPORT',
          driverName: 'Scholar/staff transport',
          income: Number(claim.amount),
          startingKm: null,
          endKm: null,
          petrolPoured: null,
          petrolLitres: null,
          expenseDetail: null,
          expensePrice: null,
          expenseImage: null,
          petrolSlip: null,
          driverId: claim.collectedByDriverId,
          loggedOn: claim.paidAt,
          approvalStatus: 'approved',
          approvedAt: new Date(),
          approvedBy: actor?.sub ?? null,
          incomeStream: 'scholar',
          tripId: null,
          scholarPaymentId: claim.id,
        } as TenantIncome);
        return repo.save(entity);
      });

      claim.status = 'approved';
      claim.approvedAt = new Date();
      claim.approvedByUserId = actor?.sub ?? null;
      claim.incomeId = income.id;
      claim.rejectReason = null;
      const saved = await cRepo.save(claim);

      await this.auditService.log({
        action: 'tenant.transport.payment.approve',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'transport_payment_claim',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          amount: saved.amount,
          vehicleId: saved.vehicleId,
          incomeId: income.id,
          passengerId: saved.passengerId,
        },
      });
      return saved;
    });
  }

  async rejectClaim(id: string, reason: string, actor?: { sub?: string }) {
    if (!reason?.trim()) throw new BadRequestException('reject reason required');
    return this.claims().withSchema(async (repo) => {
      const claim = await repo.findOne({ where: { id } });
      if (!claim) throw new NotFoundException('Payment claim not found');
      if (claim.status === 'approved') {
        throw new BadRequestException('Cannot reject an approved claim');
      }
      claim.status = 'rejected';
      claim.rejectReason = reason.trim();
      claim.approvedByUserId = actor?.sub ?? null;
      claim.approvedAt = new Date();
      const saved = await repo.save(claim);
      await this.auditService.log({
        action: 'tenant.transport.payment.reject',
        actorUserId: actor?.sub ?? null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'transport_payment_claim',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          reason: saved.rejectReason,
        },
      });
      return saved;
    });
  }

  async driverCollectionSummary(from?: string, to?: string) {
    const claims = await this.listClaims();
    const filtered = claims.filter((c) => {
      const d = ymd(new Date(c.paidAt));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return Boolean(c.collectedByDriverId);
    });
    const byDriver = new Map<
      string,
      { driverId: string; pending: number; approved: number; rejected: number; count: number }
    >();
    for (const c of filtered) {
      const id = c.collectedByDriverId!;
      const row = byDriver.get(id) ?? {
        driverId: id,
        pending: 0,
        approved: 0,
        rejected: 0,
        count: 0,
      };
      row.count += 1;
      const amt = Number(c.amount);
      if (c.status === 'pending') row.pending += amt;
      else if (c.status === 'approved') row.approved += amt;
      else if (c.status === 'rejected') row.rejected += amt;
      byDriver.set(id, row);
    }
    return Array.from(byDriver.values());
  }

  async reportByVehicle(from?: string, to?: string) {
    const claims = (await this.listClaims('approved')).filter((c) => {
      const d = ymd(new Date(c.paidAt));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
    const vehicles = await this.vehicles().withSchema((repo) => repo.find());
    const vMap = new Map(vehicles.map((v) => [v.id, v]));
    const byVehicle = new Map<string, { vehicleId: string; label: string; total: number; count: number }>();
    for (const c of claims) {
      const key = c.vehicleId ?? 'unassigned';
      const v = c.vehicleId ? vMap.get(c.vehicleId) : null;
      const row = byVehicle.get(key) ?? {
        vehicleId: key,
        label: v?.registrationNumber ?? v?.label ?? 'Unassigned',
        total: 0,
        count: 0,
      };
      row.total += Number(c.amount);
      row.count += 1;
      byVehicle.set(key, row);
    }
    return Array.from(byVehicle.values()).sort((a, b) => b.total - a.total);
  }

  async reportByGroup(from?: string, to?: string) {
    const arrears = await this.getArrears({ from, to });
    const byGroup = new Map<
      string,
      { groupId: string; name: string; expected: number; paid: number; balance: number; count: number }
    >();
    for (const row of arrears) {
      const key = row.groupId ?? 'ungrouped';
      const g = byGroup.get(key) ?? {
        groupId: key,
        name: row.groupName ?? 'Ungrouped',
        expected: 0,
        paid: 0,
        balance: 0,
        count: 0,
      };
      g.expected += row.expected;
      g.paid += row.paid;
      g.balance += row.balance;
      g.count += 1;
      byGroup.set(key, g);
    }
    return Array.from(byGroup.values()).map((g) => ({
      ...g,
      collectionRate: g.expected > 0 ? g.paid / g.expected : 0,
    }));
  }

  async summary(from?: string, to?: string) {
    const arrears = await this.getArrears({ from, to });
    const expected = arrears.reduce((s, r) => s + r.expected, 0);
    const paid = arrears.reduce((s, r) => s + r.paid, 0);
    const overdue = arrears.filter((r) => r.status === 'overdue').length;
    return {
      passengers: arrears.length,
      expected,
      paid,
      balance: Math.max(0, expected - paid),
      overdueCount: overdue,
      collectionRate: expected > 0 ? paid / expected : 0,
    };
  }

  newHouseholdId() {
    return { householdId: randomUUID() };
  }
}
