import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantVehicle } from './tenant-vehicle.entity';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';

type CreateVehiclePayload = {
  label: string;
  registrationNumber: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  vin?: string | null;
  engineNumber?: string | null;
  licenseDiskNumber?: string | null;
  licenseDiskExpiry?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceAmount?: number | null;
  insuranceExpiry?: string | null;
  ownerName?: string | null;
  ownerContact?: string | null;
  ownerAddress?: string | null;
  roadworthyCertificateNumber?: string | null;
  roadworthyExpiry?: string | null;
  permitNumber?: string | null;
  permitExpiry?: string | null;
  notes?: string | null;
};

type UpdateVehiclePayload = {
  isActive?: boolean;
  label?: string;
  registrationNumber?: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  vin?: string | null;
  engineNumber?: string | null;
  licenseDiskNumber?: string | null;
  licenseDiskExpiry?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceAmount?: number | null;
  insuranceExpiry?: string | null;
  ownerName?: string | null;
  ownerContact?: string | null;
  ownerAddress?: string | null;
  roadworthyCertificateNumber?: string | null;
  roadworthyExpiry?: string | null;
  permitNumber?: string | null;
  permitExpiry?: string | null;
  notes?: string | null;
};

@Injectable()
export class TenantVehiclesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(): Promise<TenantVehicle[]> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantVehicle,
    );
    return tenantRepo.withSchema(repo => repo.find());
  }

  async create(payload: CreateVehiclePayload): Promise<TenantVehicle> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantVehicle,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({
        where: { registrationNumber: payload.registrationNumber },
      });
      if (existing) {
        throw new ConflictException('Vehicle already exists');
      }

      const vehicle = repo.create({
        label: payload.label,
        registrationNumber: payload.registrationNumber,
        make: payload.make ?? null,
        model: payload.model ?? null,
        year: payload.year ?? null,
        color: payload.color ?? null,
        vin: payload.vin ?? null,
        engineNumber: payload.engineNumber ?? null,
        licenseDiskNumber: payload.licenseDiskNumber ?? null,
        licenseDiskExpiry: payload.licenseDiskExpiry ? new Date(payload.licenseDiskExpiry) : null,
        insuranceProvider: payload.insuranceProvider ?? null,
        insurancePolicyNumber: payload.insurancePolicyNumber ?? null,
        insuranceAmount: payload.insuranceAmount ?? null,
        insuranceExpiry: payload.insuranceExpiry ? new Date(payload.insuranceExpiry) : null,
        ownerName: payload.ownerName ?? null,
        ownerContact: payload.ownerContact ?? null,
        ownerAddress: payload.ownerAddress ?? null,
        roadworthyCertificateNumber: payload.roadworthyCertificateNumber ?? null,
        roadworthyExpiry: payload.roadworthyExpiry ? new Date(payload.roadworthyExpiry) : null,
        permitNumber: payload.permitNumber ?? null,
        permitExpiry: payload.permitExpiry ? new Date(payload.permitExpiry) : null,
        notes: payload.notes ?? null,
        isActive: true,
      });
      const saved = await repo.save(vehicle);
      await this.auditService.log({
        action: 'tenant.vehicle.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_vehicle',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          registration: saved.registrationNumber,
        },
      });
      return saved;
    });
  }

  async update(id: string, payload: UpdateVehiclePayload): Promise<TenantVehicle> {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantVehicle,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Vehicle not found');
      }

      if (typeof payload.isActive === 'boolean') {
        existing.isActive = payload.isActive;
      }
      if (payload.label !== undefined) existing.label = payload.label;
      if (payload.registrationNumber !== undefined) existing.registrationNumber = payload.registrationNumber;
      if (payload.make !== undefined) existing.make = payload.make ?? null;
      if (payload.model !== undefined) existing.model = payload.model ?? null;
      if (payload.year !== undefined) existing.year = payload.year ?? null;
      if (payload.color !== undefined) existing.color = payload.color ?? null;
      if (payload.vin !== undefined) existing.vin = payload.vin ?? null;
      if (payload.engineNumber !== undefined) existing.engineNumber = payload.engineNumber ?? null;
      if (payload.licenseDiskNumber !== undefined) existing.licenseDiskNumber = payload.licenseDiskNumber ?? null;
      if (payload.licenseDiskExpiry !== undefined) existing.licenseDiskExpiry = payload.licenseDiskExpiry ? new Date(payload.licenseDiskExpiry) : null;
      if (payload.insuranceProvider !== undefined) existing.insuranceProvider = payload.insuranceProvider ?? null;
      if (payload.insurancePolicyNumber !== undefined) existing.insurancePolicyNumber = payload.insurancePolicyNumber ?? null;
      if (payload.insuranceAmount !== undefined) existing.insuranceAmount = payload.insuranceAmount ?? null;
      if (payload.insuranceExpiry !== undefined) existing.insuranceExpiry = payload.insuranceExpiry ? new Date(payload.insuranceExpiry) : null;
      if (payload.ownerName !== undefined) existing.ownerName = payload.ownerName ?? null;
      if (payload.ownerContact !== undefined) existing.ownerContact = payload.ownerContact ?? null;
      if (payload.ownerAddress !== undefined) existing.ownerAddress = payload.ownerAddress ?? null;
      if (payload.roadworthyCertificateNumber !== undefined) existing.roadworthyCertificateNumber = payload.roadworthyCertificateNumber ?? null;
      if (payload.roadworthyExpiry !== undefined) existing.roadworthyExpiry = payload.roadworthyExpiry ? new Date(payload.roadworthyExpiry) : null;
      if (payload.permitNumber !== undefined) existing.permitNumber = payload.permitNumber ?? null;
      if (payload.permitExpiry !== undefined) existing.permitExpiry = payload.permitExpiry ? new Date(payload.permitExpiry) : null;
      if (payload.notes !== undefined) existing.notes = payload.notes ?? null;

      const saved = await repo.save(existing);
      await this.auditService.log({
        action: 'tenant.vehicle.update',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_vehicle',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          isActive: saved.isActive,
        },
      });
      return saved;
    });
  }

  async remove(id: string) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantVehicle,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Vehicle not found');
      }
      await repo.remove(existing);
      await this.auditService.log({
        action: 'tenant.vehicle.delete',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_vehicle',
        targetId: id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          registration: existing.registrationNumber,
        },
      });
      return { deleted: true };
    });
  }

  /**
   * Cost-per-km + maintenance snapshot for a vehicle (last 30 days incomes).
   * Distance from income odometer; costs = petrol + income-line expenses + completed maintenance.
   */
  async getHealth(id: string): Promise<{
    vehicleId: string;
    label: string;
    registrationNumber: string;
    periodDays: number;
    tripKm: number;
    fuelRand: number;
    expenseRand: number;
    maintenanceRand: number;
    totalCostRand: number;
    costPerKm: number | null;
    odometer: number | null;
    maintenanceOpen: number;
    maintenanceOverdue: number;
  }> {
    const schema = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `SELECT id, label, registration_number FROM "${schema}"."vehicles" WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Vehicle not found');
    const v = rows[0] as {
      id: string;
      label: string;
      registration_number: string;
    };
    const label = String(v.label);
    const periodDays = 30;

    const incomeAgg = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(GREATEST(COALESCE(end_km,0) - COALESCE(starting_km,0), 0)), 0)::float AS trip_km,
         COALESCE(SUM(COALESCE(petrol_poured, 0)), 0)::float AS fuel_rand,
         COALESCE(SUM(COALESCE(expense_price, 0)), 0)::float AS expense_rand,
         MAX(end_km) AS odometer
       FROM "${schema}"."vehicle_incomes"
       WHERE vehicle = $1
         AND logged_on >= now() - ($2 || ' days')::interval`,
      [label, String(periodDays)],
    );
    const ia = incomeAgg[0] as Record<string, unknown>;
    const tripKm = Number(ia.trip_km ?? 0);
    const fuelRand = Number(ia.fuel_rand ?? 0);
    const expenseRand = Number(ia.expense_rand ?? 0);
    const odometer = ia.odometer != null ? Number(ia.odometer) : null;

    const maintCost = await this.dataSource.query(
      `SELECT COALESCE(SUM(COALESCE(cost, 0)), 0)::float AS maintenance_rand
       FROM "${schema}"."maintenance_tasks"
       WHERE (vehicle_label = $1 OR vehicle_id::text = $2)
         AND is_completed = true
         AND COALESCE(completed_at, updated_at) >= now() - ($3 || ' days')::interval`,
      [label, id, String(periodDays)],
    );

    let maintenanceRand = Number(
      (maintCost[0] as Record<string, unknown>)?.maintenance_rand ?? 0,
    );
    if (!Number.isFinite(maintenanceRand)) maintenanceRand = 0;

    const openRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS open_count
       FROM "${schema}"."maintenance_tasks"
       WHERE (vehicle_label = $1 OR vehicle_id::text = $2)
         AND is_completed = false`,
      [label, id],
    );

    const totalCostRand = fuelRand + expenseRand + maintenanceRand;
    const costPerKm = tripKm > 0 ? totalCostRand / tripKm : null;

    return {
      vehicleId: id,
      label,
      registrationNumber: String(v.registration_number),
      periodDays,
      tripKm,
      fuelRand,
      expenseRand,
      maintenanceRand,
      totalCostRand,
      costPerKm,
      odometer,
      maintenanceOpen: Number(
        (openRows[0] as Record<string, unknown>)?.open_count ?? 0,
      ),
      maintenanceOverdue: 0,
    };
  }
}

