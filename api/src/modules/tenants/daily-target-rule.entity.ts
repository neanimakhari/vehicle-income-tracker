import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DailyTargetRuleScope = 'tenant' | 'driver';
export type DailyTargetRuleType =
  | 'weekday'
  | 'date_range'
  | 'exact_date'
  | 'closed';

@Entity({ name: 'daily_target_rules', schema: 'platform' })
export class DailyTargetRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Tenant slug. */
  @Column({ name: 'tenant_id', type: 'varchar' })
  tenantId: string;

  @Column({ type: 'varchar' })
  scope: DailyTargetRuleScope;

  @Column({ name: 'driver_user_id', type: 'uuid', nullable: true, default: null })
  driverUserId: string | null;

  @Column({ name: 'rule_type', type: 'varchar' })
  ruleType: DailyTargetRuleType;

  @Column({ type: 'numeric', nullable: true, default: null })
  amount: number | null;

  /** 0=Sun .. 6=Sat (JS getDay()). */
  @Column({ type: 'int', array: true, nullable: true, default: null })
  weekdays: number[] | null;

  @Column({ name: 'start_date', type: 'date', nullable: true, default: null })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true, default: null })
  endDate: string | null;

  @Column({ name: 'exact_date', type: 'date', nullable: true, default: null })
  exactDate: string | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
