import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'vehicle_incomes' })
export class TenantIncome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vehicle: string;

  @Column({ name: 'driver_name' })
  driverName: string;

  @Column({ type: 'numeric', default: 0 })
  income: number;

  @Column({ name: 'starting_km', type: 'int', nullable: true, default: null })
  startingKm: number | null;

  @Column({ name: 'end_km', type: 'int', nullable: true, default: null })
  endKm: number | null;

  @Column({ name: 'petrol_poured', type: 'numeric', nullable: true, default: null })
  petrolPoured: number | null;

  @Column({ name: 'petrol_litres', type: 'numeric', nullable: true, default: null })
  petrolLitres: number | null;

  @Column({ name: 'expense_detail', type: 'varchar', nullable: true, default: null })
  expenseDetail: string | null;

  @Column({ name: 'expense_price', type: 'numeric', nullable: true, default: null })
  expensePrice: number | null;

  @Column({ name: 'expense_image', type: 'text', nullable: true, default: null })
  expenseImage: string | null;

  @Column({ name: 'petrol_slip', type: 'text', nullable: true, default: null })
  petrolSlip: string | null;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true, default: null })
  driverId: string | null;

  @Column({ name: 'logged_on', type: 'timestamp' })
  loggedOn: Date;

  @Column({ name: 'approval_status', type: 'varchar', length: 20, default: 'auto' })
  approvalStatus: 'auto' | 'pending' | 'approved' | 'rejected';

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true, default: null })
  approvedAt: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true, default: null })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

