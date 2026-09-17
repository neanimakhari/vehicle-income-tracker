import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsAndFeatureFlags1700000000027 implements MigrationInterface {
  name = 'AddNotificationsAndFeatureFlags1700000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" ADD COLUMN IF NOT EXISTS "feature_flags" text[] NOT NULL DEFAULT '{}'`,
    );
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."notification_categories" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" varchar NOT NULL,
          "description" text NULL,
          "is_default" boolean NOT NULL DEFAULT false,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."notifications" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "category_id" uuid NULL,
          "title" varchar NOT NULL,
          "message" text NOT NULL,
          "target_role" varchar NULL,
          "target_user_id" uuid NULL,
          "status" varchar NOT NULL DEFAULT 'sent',
          "created_by" uuid NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "fk_notifications_category_id" FOREIGN KEY ("category_id")
            REFERENCES "${schema}"."notification_categories"("id") ON DELETE SET NULL
        )`,
      );
      await queryRunner.query(
        `INSERT INTO "${schema}"."notification_categories" ("name","description","is_default")
         SELECT x.name, x.description, true
         FROM (VALUES
           ('Alerts', 'General alerts'),
           ('Payments', 'Payment notices'),
           ('Maintenance', 'Maintenance updates'),
           ('System', 'System messages')
         ) AS x(name, description)
         WHERE NOT EXISTS (
           SELECT 1 FROM "${schema}"."notification_categories" c WHERE c.name = x.name
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
        `DROP TABLE IF EXISTS "${schema}"."notifications"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."notification_categories"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "platform"."tenants" DROP COLUMN IF EXISTS "feature_flags"`,
    );
  }
}
