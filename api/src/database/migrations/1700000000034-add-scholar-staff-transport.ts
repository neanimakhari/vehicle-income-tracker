import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScholarStaffTransport1700000000034 implements MigrationInterface {
  name = 'AddScholarStaffTransport1700000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicles" ADD COLUMN IF NOT EXISTS "seat_capacity" int NULL`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."transport_groups" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar NOT NULL,
          "kind" varchar NOT NULL DEFAULT 'school',
          "default_amount" numeric NOT NULL DEFAULT 0,
          "cadence" varchar NOT NULL DEFAULT 'monthly',
          "due_day" int NULL,
          "grace_days" int NOT NULL DEFAULT 7,
          "notes" text NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."transport_passengers" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "type" varchar NOT NULL DEFAULT 'scholar',
          "name" varchar NOT NULL,
          "contact_name" varchar NULL,
          "phone" varchar NULL,
          "notes" text NULL,
          "household_id" uuid NULL,
          "group_id" uuid NULL REFERENCES "${schema}"."transport_groups"("id") ON DELETE SET NULL,
          "vehicle_id" uuid NULL REFERENCES "${schema}"."vehicles"("id") ON DELETE SET NULL,
          "driver_user_id" uuid NULL,
          "fee_amount" numeric NULL,
          "fee_cadence" varchar NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_transport_passengers_vehicle"
          ON "${schema}"."transport_passengers" ("vehicle_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_transport_passengers_group"
          ON "${schema}"."transport_passengers" ("group_id")`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_transport_passengers_household"
          ON "${schema}"."transport_passengers" ("household_id")`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."transport_assignments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "passenger_id" uuid NOT NULL REFERENCES "${schema}"."transport_passengers"("id") ON DELETE CASCADE,
          "vehicle_id" uuid NOT NULL REFERENCES "${schema}"."vehicles"("id") ON DELETE CASCADE,
          "driver_user_id" uuid NULL,
          "effective_from" date NOT NULL DEFAULT CURRENT_DATE,
          "effective_to" date NULL,
          "notes" text NULL,
          "created_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."transport_fee_pauses" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "label" varchar NOT NULL,
          "start_date" date NOT NULL,
          "end_date" date NOT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."transport_billing_periods" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "passenger_id" uuid NOT NULL REFERENCES "${schema}"."transport_passengers"("id") ON DELETE CASCADE,
          "period_start" date NOT NULL,
          "period_end" date NOT NULL,
          "cadence" varchar NOT NULL DEFAULT 'monthly',
          "expected_amount" numeric NOT NULL DEFAULT 0,
          "due_date" date NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          UNIQUE ("passenger_id", "period_start", "period_end")
        )`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."transport_payment_claims" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "passenger_id" uuid NOT NULL REFERENCES "${schema}"."transport_passengers"("id") ON DELETE CASCADE,
          "billing_period_id" uuid NULL REFERENCES "${schema}"."transport_billing_periods"("id") ON DELETE SET NULL,
          "vehicle_id" uuid NULL,
          "amount" numeric NOT NULL DEFAULT 0,
          "method" varchar NOT NULL DEFAULT 'cash',
          "paid_at" timestamptz NOT NULL DEFAULT now(),
          "status" varchar NOT NULL DEFAULT 'pending',
          "notes" text NULL,
          "reject_reason" text NULL,
          "submitted_by_user_id" uuid NULL,
          "collected_by_driver_id" uuid NULL,
          "approved_by_user_id" uuid NULL,
          "approved_at" timestamptz NULL,
          "income_id" uuid NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_transport_claims_status"
          ON "${schema}"."transport_payment_claims" ("status")`,
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
        `DROP TABLE IF EXISTS "${schema}"."transport_payment_claims"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."transport_billing_periods"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."transport_fee_pauses"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."transport_assignments"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."transport_passengers"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."transport_groups"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicles" DROP COLUMN IF EXISTS "seat_capacity"`,
      );
    }
  }
}
