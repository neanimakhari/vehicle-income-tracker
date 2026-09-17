import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tenant_sla_documents', schema: 'platform' })
export class TenantSlaDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'title', type: 'varchar' })
  title: string;

  @Column({ name: 'file_name', type: 'varchar' })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar' })
  mimeType: string;

  @Column({ name: 'content_base64', type: 'text' })
  contentBase64: string;

  @Column({
    name: 'effective_from',
    type: 'date',
    nullable: true,
    default: null,
  })
  effectiveFrom: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true, default: null })
  effectiveTo: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true, default: null })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
