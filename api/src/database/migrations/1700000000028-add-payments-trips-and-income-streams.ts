import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentsTripsAndIncomeStreams1700000000028 implements MigrationInterface {
  name = 'AddPaymentsTripsAndIncomeStreams1700000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "income_stream" varchar NOT NULL DEFAULT 'general'`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "trip_id" uuid NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" ADD COLUMN IF NOT EXISTS "scholar_payment_id" uuid NULL`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."trips" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "vehicle_id" uuid NULL DEFAULT NULL,
          "driver_id" uuid NULL DEFAULT NULL,
          "status" varchar(30) NOT NULL DEFAULT 'scheduled',
          "trip_type" varchar NOT NULL DEFAULT 'general',
          "pickup_location" varchar NULL DEFAULT NULL,
          "dropoff_location" varchar NULL DEFAULT NULL,
          "scheduled_at" timestamptz NULL DEFAULT NULL,
          "started_at" timestamptz NULL DEFAULT NULL,
          "completed_at" timestamptz NULL DEFAULT NULL,
          "fare_amount" numeric NULL DEFAULT NULL,
          "distance_km" numeric NULL DEFAULT NULL,
          "notes" text NULL DEFAULT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."scholar_payments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "scholar_name" varchar NOT NULL,
          "guardian_name" varchar NULL DEFAULT NULL,
          "amount" numeric NOT NULL DEFAULT 0,
          "status" varchar NOT NULL DEFAULT 'pending',
          "due_date" date NULL DEFAULT NULL,
          "paid_at" timestamptz NULL DEFAULT NULL,
          "notes" text NULL DEFAULT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."scholar_payments"`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS "${schema}"."trips"`);
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" DROP COLUMN IF EXISTS "scholar_payment_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" DROP COLUMN IF EXISTS "trip_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicle_incomes" DROP COLUMN IF EXISTS "income_stream"`,
      );
    }
  }
}
