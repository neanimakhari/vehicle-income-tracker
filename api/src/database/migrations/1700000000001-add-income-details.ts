import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIncomeDetails1700000000001 implements MigrationInterface {
  name = 'AddIncomeDetails1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "starting_km" int NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "end_km" int NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "petrol_poured" numeric NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "petrol_litres" numeric NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "expense_detail" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "expense_image" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "petrol_slip" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "driver_id" uuid NULL`,
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
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "starting_km"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "end_km"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "petrol_poured"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "petrol_litres"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "expense_detail"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "expense_image"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "petrol_slip"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."vehicle_incomes" DROP COLUMN IF EXISTS "driver_id"`,
      );
    }
  }
}


