import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'transport_payment_claims' })
export class TransportPaymentClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  @Column({ name: 'billing_period_id', type: 'uuid', nullable: true })
  billingPeriodId: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Column({ type: 'numeric', default: 0 })
  amount: number;

  @Column({ default: 'cash' })
  method: string;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  @Column({ default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ name: 'submitted_by_user_id', type: 'uuid', nullable: true })
  submittedByUserId: string | null;

  @Column({ name: 'collected_by_driver_id', type: 'uuid', nullable: true })
  collectedByDriverId: string | null;

  @Column({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'income_id', type: 'uuid', nullable: true })
  incomeId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
