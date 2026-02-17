import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'vehicles' })
export class TenantVehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Column({ name: 'registration_number' })
  registrationNumber: string;

  // Vehicle Details
  @Column({ name: 'make', type: 'varchar', nullable: true })
  make: string | null;

  @Column({ name: 'model', type: 'varchar', nullable: true })
  model: string | null;

  @Column({ name: 'year', type: 'int', nullable: true })
  year: number | null;

  @Column({ name: 'color', type: 'varchar', nullable: true })
  color: string | null;

  @Column({ name: 'vin', type: 'varchar', nullable: true })
  vin: string | null;

  @Column({ name: 'engine_number', type: 'varchar', nullable: true })
  engineNumber: string | null;

  // License Disk Information
  @Column({ name: 'license_disk_number', type: 'varchar', nullable: true })
  licenseDiskNumber: string | null;

  @Column({ name: 'license_disk_expiry', type: 'date', nullable: true })
  licenseDiskExpiry: Date | null;

  // Insurance Information
  @Column({ name: 'insurance_provider', type: 'varchar', nullable: true })
  insuranceProvider: string | null;

  @Column({ name: 'insurance_policy_number', type: 'varchar', nullable: true })
  insurancePolicyNumber: string | null;

  @Column({ name: 'insurance_amount', type: 'numeric', nullable: true })
  insuranceAmount: number | null;

  @Column({ name: 'insurance_expiry', type: 'date', nullable: true })
  insuranceExpiry: Date | null;

  // Owner Information
  @Column({ name: 'owner_name', type: 'varchar', nullable: true })
  ownerName: string | null;

  @Column({ name: 'owner_contact', type: 'varchar', nullable: true })
  ownerContact: string | null;

  @Column({ name: 'owner_address', type: 'text', nullable: true })
  ownerAddress: string | null;

  // Additional Documentation
  @Column({ name: 'roadworthy_certificate_number', type: 'varchar', nullable: true })
  roadworthyCertificateNumber: string | null;

  @Column({ name: 'roadworthy_expiry', type: 'date', nullable: true })
  roadworthyExpiry: Date | null;

  @Column({ name: 'permit_number', type: 'varchar', nullable: true })
  permitNumber: string | null;

  @Column({ name: 'permit_expiry', type: 'date', nullable: true })
  permitExpiry: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}



