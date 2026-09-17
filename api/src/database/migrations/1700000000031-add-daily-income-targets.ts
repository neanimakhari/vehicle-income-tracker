import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDailyIncomeTargets1700000000031 implements MigrationInterface {
  name = 'AddDailyIncomeTargets1700000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "default_daily_target_amount" numeric NULL`,
    );

    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "daily_target_amount" numeric NULL`,
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
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "daily_target_amount"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "default_daily_target_amount"`,
    );
  }
}
