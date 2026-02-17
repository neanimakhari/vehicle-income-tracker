import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantSecuritySettings1700000000006 implements MigrationInterface {
  name = 'AddTenantSecuritySettings1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "require_biometrics" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "session_timeout_minutes" int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "enforce_ip_allowlist" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "allowed_ips" text[] NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "enforce_device_allowlist" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "enforce_device_allowlist"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "allowed_ips"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "enforce_ip_allowlist"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "session_timeout_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "require_biometrics"`,
    );
  }
}

