import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleDocumentationFields1700000000013 implements MigrationInterface {
  name = 'AddVehicleDocumentationFields1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "make" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "model" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "year" int NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "color" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "vin" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "engine_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "license_disk_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "license_disk_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "insurance_provider" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "insurance_policy_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "insurance_amount" numeric NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "insurance_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "owner_name" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "owner_contact" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "owner_address" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "roadworthy_certificate_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "roadworthy_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "permit_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "permit_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "notes" text NULL`,
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
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "make"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "model"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "year"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "color"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "vin"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "engine_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "license_disk_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "license_disk_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "insurance_provider"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "insurance_policy_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "insurance_amount"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "insurance_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "owner_name"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "owner_contact"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "owner_address"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "roadworthy_certificate_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "roadworthy_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "permit_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "permit_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicles" DROP COLUMN IF EXISTS "notes"`,
      );
    }
  }
}

