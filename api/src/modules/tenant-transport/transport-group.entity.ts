import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'transport_groups' })
export class TransportGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'school' })
  kind: string;

  @Column({ name: 'default_amount', type: 'numeric', default: 0 })
  defaultAmount: number;

  @Column({ default: 'monthly' })
  cadence: string;

  @Column({ name: 'due_day', type: 'int', nullable: true })
  dueDay: number | null;

  @Column({ name: 'grace_days', type: 'int', default: 7 })
  graceDays: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
