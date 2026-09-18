import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tenant_entitlements', schema: 'platform' })
export class TenantEntitlementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', unique: true })
  tenantId: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true, default: null })
  planId: string | null;

  @Column({ name: 'module_overrides', type: 'jsonb', default: {} })
  moduleOverrides: Record<string, boolean>;

  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
