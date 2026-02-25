import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures approval_status, approved_at, approved_by exist on vehicle_incomes in every tenant schema.
 * Tenant schemas created after AddIncomeApprovalStatus1700000000020 were missing these columns.
 */
export class EnsureIncomeApprovalColumns1700000000022 implements MigrationInterface {
  name = 'EnsureIncomeApprovalColumns1700000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants as { slug: string }[]) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "approval_status" varchar(20) DEFAULT 'approved'`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "approved_at" timestamp NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "approved_by" uuid NULL`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: column removal would break app; rollback handled by previous migration down if needed.
  }
}
