import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultiEntryLogColumns1700000000026 implements MigrationInterface {
  name = 'AddMultiEntryLogColumns1700000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "petrol_logs" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "expense_logs" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "income_logs" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."expenses" ADD COLUMN IF NOT EXISTS "expense_logs" text NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."expenses" DROP COLUMN IF EXISTS "expense_logs"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" DROP COLUMN IF EXISTS "income_logs"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" DROP COLUMN IF EXISTS "expense_logs"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" DROP COLUMN IF EXISTS "petrol_logs"`,
      );
    }
  }
}
