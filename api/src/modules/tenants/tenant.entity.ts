import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'tenants', schema: 'platform' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'require_mfa', default: false })
  requireMfa: boolean;

  @Column({ name: 'require_mfa_users', default: false })
  requireMfaUsers: boolean;

  @Column({ name: 'require_biometrics', default: false })
  requireBiometrics: boolean;

  @Column({ name: 'session_timeout_minutes', type: 'int', nullable: true })
  sessionTimeoutMinutes: number | null;

  @Column({ name: 'enforce_ip_allowlist', default: false })
  enforceIpAllowlist: boolean;

  @Column({ name: 'allowed_ips', type: 'text', array: true, nullable: true })
  allowedIps: string[] | null;

  @Column({ name: 'enforce_device_allowlist', default: false })
  enforceDeviceAllowlist: boolean;

  // Business / contact info
  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'registration_number', type: 'varchar', nullable: true })
  registrationNumber: string | null;

  @Column({ name: 'tax_id', type: 'varchar', nullable: true })
  taxId: string | null;

  @Column({ name: 'website', type: 'varchar', nullable: true })
  website: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'max_drivers', type: 'int', nullable: true })
  maxDrivers: number | null;

  @Column({ name: 'max_storage_mb', type: 'int', nullable: true })
  maxStorageMb: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

