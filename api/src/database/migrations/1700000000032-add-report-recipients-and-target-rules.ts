import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportRecipientsAndTargetRules1700000000032
  implements MigrationInterface
{
  name = 'AddReportRecipientsAndTargetRules1700000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."tenant_report_recipients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" varchar NOT NULL,
        "email" varchar NOT NULL,
        "label" varchar NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_tenant_report_recipients_tenant_email" UNIQUE ("tenant_id", "email")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tenant_report_recipients_tenant"
        ON "platform"."tenant_report_recipients" ("tenant_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."daily_target_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" varchar NOT NULL,
        "scope" varchar NOT NULL,
        "driver_user_id" uuid NULL,
        "rule_type" varchar NOT NULL,
        "amount" numeric NULL,
        "weekdays" int[] NULL,
        "start_date" date NULL,
        "end_date" date NULL,
        "exact_date" date NULL,
        "priority" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_daily_target_rules_scope"
          CHECK ("scope" IN ('tenant', 'driver')),
        CONSTRAINT "chk_daily_target_rules_type"
          CHECK ("rule_type" IN ('weekday', 'date_range', 'exact_date', 'closed'))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_daily_target_rules_tenant"
        ON "platform"."daily_target_rules" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_daily_target_rules_tenant_driver"
        ON "platform"."daily_target_rules" ("tenant_id", "driver_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."daily_target_rules"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."tenant_report_recipients"`,
    );
  }
}
