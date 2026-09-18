import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'driver_email_index', schema: 'platform' })
@Index('idx_driver_email_index_email', ['emailNormalized'])
export class DriverEmailIndex {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'email_normalized', type: 'varchar', length: 320 })
  emailNormalized!: string;

  @Column({ name: 'tenant_slug', type: 'varchar', length: 64 })
  tenantSlug!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
