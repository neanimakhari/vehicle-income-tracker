import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantMaintenanceTask } from './tenant-maintenance.entity';

type CreateMaintenancePayload = {
  vehicleId?: string | null;
  vehicleLabel: string;
  registrationNumber?: string | null;
  maintenanceType?: string;
  dueKm?: number | null;
  dueDate?: string | null;
  lastServiceKm?: number | null;
  lastServiceDate?: string | null;
  serviceIntervalKm?: number | null;
  serviceIntervalDays?: number | null;
  cost?: number | null;
  notes?: string | null;
};

type UpdateMaintenancePayload = {
  maintenanceType?: string;
  dueKm?: number | null;
  dueDate?: string | null;
  lastServiceKm?: number | null;
  lastServiceDate?: string | null;
  serviceIntervalKm?: number | null;
  serviceIntervalDays?: number | null;
  cost?: number | null;
  notes?: string | null;
  isCompleted?: boolean;
  completedKm?: number | null;
};

@Injectable()
export class TenantMaintenanceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll() {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantMaintenanceTask,
    );
    return tenantRepo.withSchema(async repo => {
      const tasks = await repo.find({ order: { createdAt: 'DESC' } });
      const results = await Promise.all(
        tasks.map(async task => {
          // Get current KM from the latest income record for this vehicle
          let currentKm: number | null = null;
          let lastIncomeDate: Date | null = null;
          if (task.vehicleLabel) {
            const rows = await repo.manager.query(
              `SELECT MAX(end_km) AS max_km, MAX(logged_on) AS last_income_date 
               FROM vehicle_incomes 
               WHERE vehicle = $1 AND end_km IS NOT NULL`,
              [task.vehicleLabel],
            );
            if (rows?.[0]?.max_km) {
              currentKm = Number(rows[0].max_km);
            }
            if (rows?.[0]?.last_income_date) {
              lastIncomeDate = new Date(rows[0].last_income_date);
            }
          }

          // Calculate KM remaining until maintenance is due
          const kmRemaining =
            task.dueKm != null && currentKm != null ? task.dueKm - currentKm : null;

          // Calculate days remaining
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const now = new Date();
          const daysRemaining =
            dueDate != null ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

          // Calculate KM since last service (if completed task has completedKm)
          const kmSinceLastService = task.isCompleted && task.completedKm && currentKm
            ? currentKm - task.completedKm
            : task.lastServiceKm && currentKm
            ? currentKm - task.lastServiceKm
            : null;

          // Calculate days since last service
          const daysSinceLastService = task.lastServiceDate
            ? Math.ceil((now.getTime() - new Date(task.lastServiceDate).getTime()) / (1000 * 60 * 60 * 24))
            : task.completedAt
            ? Math.ceil((now.getTime() - new Date(task.completedAt).getTime()) / (1000 * 60 * 60 * 24))
            : null;

          // Determine status
          let status: 'ok' | 'due_soon' | 'overdue' = 'ok';
          if (task.isCompleted) {
            status = 'ok';
          } else {
            // Check if overdue by KM
            if (kmRemaining != null && kmRemaining <= 0) {
              status = 'overdue';
            }
            // Check if overdue by date
            else if (daysRemaining != null && daysRemaining <= 0) {
              status = 'overdue';
            }
            // Check if due soon by KM (within 500km)
            else if (kmRemaining != null && kmRemaining <= 500) {
              status = 'due_soon';
            }
            // Check if due soon by date (within 7 days)
            else if (daysRemaining != null && daysRemaining <= 7) {
              status = 'due_soon';
            }
            // Check if due based on service interval
            else if (task.serviceIntervalKm && kmSinceLastService != null && kmSinceLastService >= task.serviceIntervalKm) {
              status = 'due_soon';
            }
            else if (task.serviceIntervalDays && daysSinceLastService != null && daysSinceLastService >= task.serviceIntervalDays) {
              status = 'due_soon';
            }
          }

          return {
            ...task,
            currentKm,
            lastIncomeDate,
            kmRemaining,
            daysRemaining,
            kmSinceLastService,
            daysSinceLastService,
            status,
          };
        }),
      );
      return results;
    });
  }

  async create(payload: CreateMaintenancePayload) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantMaintenanceTask,
    );
    return tenantRepo.withSchema(async repo => {
      // Get current KM from latest income record to help set due KM
      let currentKm: number | null = null;
      if (payload.vehicleLabel) {
        const rows = await repo.manager.query(
          `SELECT MAX(end_km) AS max_km FROM vehicle_incomes WHERE vehicle = $1 AND end_km IS NOT NULL`,
          [payload.vehicleLabel],
        );
        currentKm = rows?.[0]?.max_km ? Number(rows[0].max_km) : null;
      }

      // If dueKm not provided but serviceIntervalKm is, calculate it
      let dueKm = payload.dueKm;
      if (!dueKm && payload.serviceIntervalKm && currentKm) {
        dueKm = currentKm + payload.serviceIntervalKm;
      }

      // If dueDate not provided but serviceIntervalDays is, calculate it
      let dueDate = payload.dueDate;
      if (!dueDate && payload.serviceIntervalDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + payload.serviceIntervalDays);
        dueDate = futureDate.toISOString().split('T')[0];
      }

      const task = repo.create({
        vehicleId: payload.vehicleId ?? null,
        vehicleLabel: payload.vehicleLabel,
        registrationNumber: payload.registrationNumber ?? null,
        maintenanceType: payload.maintenanceType ?? 'other',
        dueKm,
        dueDate,
        lastServiceKm: payload.lastServiceKm ?? currentKm,
        lastServiceDate: payload.lastServiceDate ?? null,
        serviceIntervalKm: payload.serviceIntervalKm ?? null,
        serviceIntervalDays: payload.serviceIntervalDays ?? null,
        cost: payload.cost ?? null,
        notes: payload.notes ?? null,
        isCompleted: false,
        completedAt: null,
        completedKm: null,
      });
      const saved = await repo.save(task);
      await this.auditService.log({
        action: 'tenant.maintenance.create',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_maintenance',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          vehicle: saved.vehicleLabel,
          maintenanceType: saved.maintenanceType,
        },
      });
      return saved;
    });
  }

  async update(id: string, payload: UpdateMaintenancePayload) {
    const tenantRepo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      TenantMaintenanceTask,
    );
    return tenantRepo.withSchema(async repo => {
      const existing = await repo.findOne({ where: { id } });
      if (!existing) {
        throw new NotFoundException('Maintenance task not found');
      }

      // Get current KM when marking as completed
      let currentKm: number | null = null;
      if (payload.isCompleted && existing.vehicleLabel) {
        const rows = await repo.manager.query(
          `SELECT MAX(end_km) AS max_km FROM vehicle_incomes WHERE vehicle = $1 AND end_km IS NOT NULL`,
          [existing.vehicleLabel],
        );
        currentKm = rows?.[0]?.max_km ? Number(rows[0].max_km) : null;
      }

      if (payload.maintenanceType !== undefined) {
        existing.maintenanceType = payload.maintenanceType;
      }
      if (payload.dueKm !== undefined) {
        existing.dueKm = payload.dueKm;
      }
      if (payload.dueDate !== undefined) {
        existing.dueDate = payload.dueDate;
      }
      if (payload.lastServiceKm !== undefined) {
        existing.lastServiceKm = payload.lastServiceKm;
      }
      if (payload.lastServiceDate !== undefined) {
        existing.lastServiceDate = payload.lastServiceDate;
      }
      if (payload.serviceIntervalKm !== undefined) {
        existing.serviceIntervalKm = payload.serviceIntervalKm;
      }
      if (payload.serviceIntervalDays !== undefined) {
        existing.serviceIntervalDays = payload.serviceIntervalDays;
      }
      if (payload.cost !== undefined) {
        existing.cost = payload.cost;
      }
      if (payload.notes !== undefined) {
        existing.notes = payload.notes;
      }
      if (payload.isCompleted !== undefined) {
        existing.isCompleted = payload.isCompleted;
        existing.completedAt = payload.isCompleted ? new Date() : null;
        // When completing, save the current KM and update last service info
        if (payload.isCompleted) {
          existing.completedKm = payload.completedKm ?? currentKm;
          if (!existing.lastServiceKm && currentKm) {
            existing.lastServiceKm = currentKm;
          }
          if (!existing.lastServiceDate) {
            existing.lastServiceDate = new Date().toISOString().split('T')[0];
          }
          // Auto-create next maintenance if interval is set
          if (existing.serviceIntervalKm || existing.serviceIntervalDays) {
            const nextDueKm = existing.serviceIntervalKm && currentKm
              ? currentKm + existing.serviceIntervalKm
              : null;
            const nextDueDate = existing.serviceIntervalDays
              ? (() => {
                  const date = new Date();
                  date.setDate(date.getDate() + existing.serviceIntervalDays);
                  return date.toISOString().split('T')[0];
                })()
              : null;
            // Only create if there's a next due date or KM
            if (nextDueKm || nextDueDate) {
              const nextTask = repo.create({
                vehicleId: existing.vehicleId,
                vehicleLabel: existing.vehicleLabel,
                registrationNumber: existing.registrationNumber,
                maintenanceType: existing.maintenanceType,
                dueKm: nextDueKm,
                dueDate: nextDueDate,
                lastServiceKm: currentKm,
                lastServiceDate: new Date().toISOString().split('T')[0],
                serviceIntervalKm: existing.serviceIntervalKm,
                serviceIntervalDays: existing.serviceIntervalDays,
                notes: `Auto-created after completing previous ${existing.maintenanceType} maintenance`,
                isCompleted: false,
              });
              await repo.save(nextTask);
            }
          }
        } else {
          // Reopening - clear completion data
          existing.completedAt = null;
          existing.completedKm = null;
        }
      }
      const saved = await repo.save(existing);
      await this.auditService.log({
        action: 'tenant.maintenance.update',
        actorUserId: null,
        actorRole: 'TENANT_ADMIN',
        targetType: 'tenant_maintenance',
        targetId: saved.id,
        metadata: {
          tenant: this.tenantContext.getTenantId(),
          isCompleted: saved.isCompleted,
          maintenanceType: saved.maintenanceType,
        },
      });
      return saved;
    });
  }
}

