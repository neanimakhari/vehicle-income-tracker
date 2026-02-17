import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ExpiryUpdateRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity({ name: 'driver_expiry_update_requests' })
export class DriverExpiryUpdateRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: ExpiryUpdateRequestStatus;

  @Column({ name: 'requested_license_expiry', type: 'date', nullable: true })
  requestedLicenseExpiry: Date | null;

  @Column({ name: 'requested_prdp_expiry', type: 'date', nullable: true })
  requestedPrdpExpiry: Date | null;

  @Column({ name: 'requested_medical_certificate_expiry', type: 'date', nullable: true })
  requestedMedicalCertificateExpiry: Date | null;

  /** JSON array of driver_document IDs (UUIDs) the driver attached as supporting docs */
  @Column({ name: 'supporting_document_ids', type: 'jsonb', nullable: true })
  supportingDocumentIds: string[] | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;
}

