import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookSubscriptions1700000000017 implements MigrationInterface {
  name = 'AddWebhookSubscriptions1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."webhook_subscriptions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "url" varchar NOT NULL,
          "secret" varchar(512) NOT NULL,
          "event_types" jsonb NOT NULL DEFAULT '[]',
          "active" boolean NOT NULL DEFAULT true,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )`,
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
        `DROP TABLE IF EXISTS "${schemaName}"."webhook_subscriptions"`,
      );
    }
  }
}

