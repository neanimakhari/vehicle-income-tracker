import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'plan_modules', schema: 'platform' })
export class PlanModuleEntity {
  @PrimaryColumn({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @PrimaryColumn({ name: 'module_key', type: 'varchar' })
  moduleKey: string;
}
