import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum MaintenanceType {
  OIL_CHANGE = 'oil_change',
  SERVICE = 'service',
  TIRE_ROTATION = 'tire_rotation',
  BRAKE_SERVICE = 'brake_service',
  FILTER_REPLACEMENT = 'filter_replacement',
  BATTERY_CHECK = 'battery_check',
  INSPECTION = 'inspection',
  OTHER = 'other',
}

@Entity({ name: 'maintenance_tasks' })
export class TenantMaintenanceTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true, default: null })
  vehicleId: string | null;

  @Column({ name: 'vehicle_label', type: 'varchar' })
  vehicleLabel: string;

  @Column({ name: 'registration_number', type: 'varchar', nullable: true, default: null })
  registrationNumber: string | null;

  @Column({ name: 'maintenance_type', type: 'varchar', nullable: true, default: MaintenanceType.OTHER })
  maintenanceType: string;

  @Column({ name: 'due_km', type: 'int', nullable: true, default: null })
  dueKm: number | null;

  @Column({ name: 'due_date', type: 'date', nullable: true, default: null })
  dueDate: string | null;

  @Column({ name: 'last_service_km', type: 'int', nullable: true, default: null })
  lastServiceKm: number | null;

  @Column({ name: 'last_service_date', type: 'date', nullable: true, default: null })
  lastServiceDate: string | null;

  @Column({ name: 'service_interval_km', type: 'int', nullable: true, default: null })
  serviceIntervalKm: number | null;

  @Column({ name: 'service_interval_days', type: 'int', nullable: true, default: null })
  serviceIntervalDays: number | null;

  @Column({ name: 'cost', type: 'numeric', nullable: true, default: null })
  cost: number | null;

  @Column({ name: 'notes', type: 'text', nullable: true, default: null })
  notes: string | null;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true, default: null })
  completedAt: Date | null;

  @Column({ name: 'completed_km', type: 'int', nullable: true, default: null })
  completedKm: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

