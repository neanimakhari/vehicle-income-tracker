import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'device_bindings', schema: 'platform' })
export class DeviceBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ name: 'user_role', type: 'varchar' })
  userRole: string;

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string | null;

  @Column({ name: 'device_id', type: 'varchar' })
  deviceId: string;

  @Column({ name: 'device_name', type: 'varchar', nullable: true })
  deviceName: string | null;

  @Column({ name: 'push_token', type: 'varchar', nullable: true })
  pushToken: string | null;

  @Column({ name: 'is_trusted', type: 'boolean', default: false })
  isTrusted: boolean;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true, default: null })
  lastSeenAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true, default: null })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

