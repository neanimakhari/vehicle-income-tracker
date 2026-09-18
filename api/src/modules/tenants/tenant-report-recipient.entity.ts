import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tenant_report_recipients', schema: 'platform' })
export class TenantReportRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Tenant slug (matches auth_users.tenant_id). */
  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  label: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
