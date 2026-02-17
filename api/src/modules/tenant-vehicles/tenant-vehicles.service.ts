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
}

