import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inbox depth: source/deep_link/meta on notifications + per-user read receipts.
 */
export class AddNotificationInboxDepth1700000000044
  implements MigrationInterface
{
  name = 'AddNotificationInboxDepth1700000000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."notifications"
           ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'manual',
           ADD COLUMN IF NOT EXISTS "deep_link" varchar NULL,
           ADD COLUMN IF NOT EXISTS "meta" jsonb NOT NULL DEFAULT '{}'`,
      );
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."notification_reads" (
          "notification_id" uuid NOT NULL
            REFERENCES "${schema}"."notifications"("id") ON DELETE CASCADE,
          "user_id" uuid NOT NULL,
          "read_at" timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY ("notification_id", "user_id")
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_notifications_dedupe"
           ON "${schema}"."notifications" ((meta->>'dedupeKey'), created_at DESC)`,
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
        `DROP INDEX IF EXISTS "${schema}"."idx_notifications_dedupe"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."notification_reads"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."notifications"
           DROP COLUMN IF EXISTS "meta",
           DROP COLUMN IF EXISTS "deep_link",
           DROP COLUMN IF EXISTS "source"`,
      );
    }
  }
}
