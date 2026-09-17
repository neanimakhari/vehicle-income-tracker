import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingIncomeReminderSettings1700000000024 implements MigrationInterface {
  name = 'AddMissingIncomeReminderSettings1700000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "missing_income_reminder_enabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "missing_income_cutoff_hour" integer NOT NULL DEFAULT 21`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "missing_income_timezone" varchar NOT NULL DEFAULT 'Africa/Johannesburg'`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "missing_income_escalation_enabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "missing_income_escalation_hour" integer NOT NULL DEFAULT 8`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."missing_income_reminder_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_slug" varchar NOT NULL,
        "user_id" uuid NOT NULL,
        "reminder_date" date NOT NULL,
        "reminder_type" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_missing_income_reminder_logs" UNIQUE ("tenant_slug", "user_id", "reminder_date", "reminder_type")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."missing_income_reminder_logs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "missing_income_escalation_hour"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "missing_income_escalation_enabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "missing_income_timezone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "missing_income_cutoff_hour"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "missing_income_reminder_enabled"`,
    );
  }
}
