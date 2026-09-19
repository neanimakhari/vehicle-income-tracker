import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'tenant_brand_snapshots', schema: 'platform' })
export class TenantBrandSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_slug' })
  tenantSlug: string;

  @Column()
  label: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
