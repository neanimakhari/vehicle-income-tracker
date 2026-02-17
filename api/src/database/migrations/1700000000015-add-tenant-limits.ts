import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantLimits1700000000015 implements MigrationInterface {
  name = 'AddTenantLimits1700000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "max_drivers" int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "max_storage_mb" int NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "max_drivers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "max_storage_mb"`,
    );
  }
}
