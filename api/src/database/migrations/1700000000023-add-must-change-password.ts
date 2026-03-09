import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePassword1700000000023 implements MigrationInterface {
  name = 'AddMustChangePassword1700000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false`,
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
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "must_change_password"`,
      );
    }
  }
}
