import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommercialPackagingAndSys1700000000033
  implements MigrationInterface
{
  name = 'AddCommercialPackagingAndSys1700000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."feature_modules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "description" text NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "description" text NULL,
        "max_drivers_default" int NULL,
        "max_storage_mb_default" int NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."plan_modules" (
        "plan_id" uuid NOT NULL REFERENCES "platform"."plans"("id") ON DELETE CASCADE,
        "module_key" varchar NOT NULL REFERENCES "platform"."feature_modules"("key") ON DELETE CASCADE,
        PRIMARY KEY ("plan_id", "module_key")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."tenant_entitlements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" varchar NOT NULL UNIQUE,
        "plan_id" uuid NULL REFERENCES "platform"."plans"("id") ON DELETE SET NULL,
        "module_overrides" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "trial_ends_at" timestamptz NULL,
        "notes" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );

    await queryRunner.query(
      `INSERT INTO "platform"."feature_modules" ("key", "name", "description", "sort_order")
       VALUES
         ('reports_advanced', 'Advanced reports', 'Custom report builder and advanced insights', 10),
         ('tracking_live', 'Live tracking', 'GPS live map and trip breadcrumbs', 20),
         ('trips', 'Trips', 'Trip logging and trip reports', 30),
         ('scholar_payments', 'Scholar payments', 'Scholar / contract payment tracking', 40),
         ('notifications', 'Notifications', 'In-app and push notification centre', 50),
         ('expiry_automation', 'Expiry automation', 'Automated document expiry reminders', 60),
         ('webhooks', 'Webhooks', 'Outbound webhook integrations', 70),
         ('target_calendar', 'Target calendar', 'Weekday and date-based daily target rules', 80)
       ON CONFLICT ("key") DO NOTHING`,
    );

    await queryRunner.query(
      `INSERT INTO "platform"."plans" ("code", "name", "description", "max_drivers_default", "is_active")
       VALUES
         ('starter', 'Starter', 'Core fleet tracking only', 5, true),
         ('fleet', 'Fleet', 'Core + reports + expiry automation', 25, true),
         ('pro', 'Pro', 'Full operations suite', 100, true)
       ON CONFLICT ("code") DO NOTHING`,
    );

    await queryRunner.query(
      `INSERT INTO "platform"."plan_modules" ("plan_id", "module_key")
       SELECT p.id, m.key
       FROM "platform"."plans" p
       CROSS JOIN "platform"."feature_modules" m
       WHERE p.code = 'fleet'
         AND m.key IN ('reports_advanced', 'expiry_automation', 'target_calendar')
       ON CONFLICT DO NOTHING`,
    );

    await queryRunner.query(
      `INSERT INTO "platform"."plan_modules" ("plan_id", "module_key")
       SELECT p.id, m.key
       FROM "platform"."plans" p
       CROSS JOIN "platform"."feature_modules" m
       WHERE p.code = 'pro'
       ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."tenant_entitlements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."plan_modules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."feature_modules"`);
  }
}
