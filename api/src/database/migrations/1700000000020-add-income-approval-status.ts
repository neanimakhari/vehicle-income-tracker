import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIncomeApprovalStatus1700000000020 implements MigrationInterface {
  name = 'AddIncomeApprovalStatus1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "approval_status"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "approved_at"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "approved_by"`,
      );
    }
  }
}

