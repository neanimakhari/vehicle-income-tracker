import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'expenses' })
export class TenantExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string;

  @Column({ type: 'numeric', default: 0 })
  amount: number;

  @Column({ type: 'text', name: 'receipt_image', nullable: true, default: null })
  receiptImage: string | null;

  @Column({ type: 'timestamp', name: 'logged_on' })
  loggedOn: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

