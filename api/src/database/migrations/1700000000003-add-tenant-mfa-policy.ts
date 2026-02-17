import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantMfaPolicy1700000000003 implements MigrationInterface {
  name = 'AddTenantMfaPolicy1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "require_mfa" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "require_mfa"`,
    );
  }
}


