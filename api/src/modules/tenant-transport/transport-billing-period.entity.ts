import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'transport_billing_periods' })
export class TransportBillingPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ default: 'monthly' })
  cadence: string;

  @Column({ name: 'expected_amount', type: 'numeric', default: 0 })
  expectedAmount: number;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
