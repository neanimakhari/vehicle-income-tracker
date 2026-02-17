import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpenseReceiptImage1700000000019 implements MigrationInterface {
  name = 'AddExpenseReceiptImage1700000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."expenses" ADD COLUMN IF NOT EXISTS "receipt_image" text NULL`,
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
        `ALTER TABLE "${schemaName}"."expenses" DROP COLUMN IF EXISTS "receipt_image"`,
      );
    }
  }
}

