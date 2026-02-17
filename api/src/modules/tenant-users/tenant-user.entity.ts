import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
export class TenantUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_secret', type: 'varchar', nullable: true })
  mfaSecret: string | null;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true, default: null })
  lockedUntil: Date | null;

  @Column({ name: 'last_login_ip', type: 'varchar', nullable: true, default: null })
  lastLoginIp: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true, default: null })
  lastLoginAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Driver Profile Fields (PRDP Requirements)
  @Column({ name: 'id_number', type: 'varchar', nullable: true })
  idNumber: string | null;

  @Column({ name: 'passport_number', type: 'varchar', nullable: true })
  passportNumber: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ name: 'license_number', type: 'varchar', nullable: true })
  licenseNumber: string | null;

  @Column({ name: 'license_expiry', type: 'date', nullable: true })
  licenseExpiry: Date | null;

  @Column({ name: 'prdp_number', type: 'varchar', nullable: true })
  prdpNumber: string | null;

  @Column({ name: 'prdp_expiry', type: 'date', nullable: true })
  prdpExpiry: Date | null;

  @Column({ name: 'medical_certificate_expiry', type: 'date', nullable: true })
  medicalCertificateExpiry: Date | null;

  @Column({ name: 'bank_name', type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ name: 'bank_account_number', type: 'varchar', nullable: true })
  bankAccountNumber: string | null;

  @Column({ name: 'bank_branch_code', type: 'varchar', nullable: true })
  bankBranchCode: string | null;

  @Column({ name: 'account_holder_name', type: 'varchar', nullable: true })
  accountHolderName: string | null;

  @Column({ name: 'salary', type: 'numeric', nullable: true })
  salary: number | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'emergency_contact_name', type: 'varchar', nullable: true })
  emergencyContactName: string | null;

  @Column({ name: 'emergency_contact_phone', type: 'varchar', nullable: true })
  emergencyContactPhone: string | null;

  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture: string | null;

  @Column({ name: 'password_reset_token', type: 'varchar', nullable: true })
  passwordResetToken: string | null;

  @Column({ name: 'password_reset_expires', type: 'timestamptz', nullable: true })
  passwordResetExpires: Date | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verification_token', type: 'varchar', nullable: true })
  emailVerificationToken: string | null;

  @Column({ name: 'email_verification_expires', type: 'timestamptz', nullable: true })
  emailVerificationExpires: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

