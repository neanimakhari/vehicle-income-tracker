import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'tenant_brand_preview_tokens', schema: 'platform' })
export class TenantBrandPreviewToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column({ name: 'tenant_slug', type: 'varchar', nullable: true })
  tenantSlug: string | null;

  @Column({ name: 'kit_id', type: 'uuid', nullable: true })
  kitId: string | null;

  @Column({ default: 'draft' })
  source: string;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'created_by', type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
