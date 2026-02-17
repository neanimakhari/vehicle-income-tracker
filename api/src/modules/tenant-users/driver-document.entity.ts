import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum DocumentType {
  ID_DOCUMENT = 'id_document',
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  PRDP_CERTIFICATE = 'prdp_certificate',
  MEDICAL_CERTIFICATE = 'medical_certificate',
  BANK_STATEMENT = 'bank_statement',
  PROOF_OF_ADDRESS = 'proof_of_address',
  OTHER = 'other',
}

@Entity({ name: 'driver_documents' })
export class DriverDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'document_type', type: 'varchar' })
  documentType: DocumentType;

  @Column({ name: 'file_name', type: 'varchar' })
  fileName: string;

  @Column({ name: 'file_path', type: 'varchar' })
  filePath: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize: number;

  @Column({ name: 'mime_type', type: 'varchar' })
  mimeType: string;

  @Column({ name: 'uploaded_by', type: 'varchar', nullable: true })
  uploadedBy: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

