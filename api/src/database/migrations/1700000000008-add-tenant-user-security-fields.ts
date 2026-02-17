import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantUserSecurityFields1700000000008 implements MigrationInterface {
  name = 'AddTenantUserSecurityFields1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" int NOT NULL DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "last_login_ip" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz NULL`,
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
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "last_login_at"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "last_login_ip"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "locked_until"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "failed_login_attempts"`,
      );
    }
  }
}

