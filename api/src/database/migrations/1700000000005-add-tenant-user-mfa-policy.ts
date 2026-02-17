import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantUserMfaPolicy1700000000005 implements MigrationInterface {
  name = 'AddTenantUserMfaPolicy1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "require_mfa_users" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "require_mfa_users"`,
    );
  }
}


