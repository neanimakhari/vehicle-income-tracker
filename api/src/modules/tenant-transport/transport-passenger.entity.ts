import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'transport_passengers' })
export class TransportPassenger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'scholar' })
  type: string;

  @Column()
  name: string;

  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'household_id', type: 'uuid', nullable: true })
  householdId: string | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Column({ name: 'driver_user_id', type: 'uuid', nullable: true })
  driverUserId: string | null;

  @Column({ name: 'fee_amount', type: 'numeric', nullable: true })
  feeAmount: number | null;

  @Column({ name: 'fee_cadence', type: 'varchar', nullable: true })
  feeCadence: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
