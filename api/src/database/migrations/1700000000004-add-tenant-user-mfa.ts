import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantUserMfa1700000000004 implements MigrationInterface {
  name = 'AddTenantUserMfa1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "mfa_secret" varchar NULL`,
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
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "mfa_secret"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "mfa_enabled"`,
      );
    }
  }
}


