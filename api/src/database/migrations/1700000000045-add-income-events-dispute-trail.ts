import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-income dispute trail: who created/edited/approved/rejected and why.
 */
export class AddIncomeEventsDisputeTrail1700000000045
  implements MigrationInterface
{
  name = 'AddIncomeEventsDisputeTrail1700000000045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );
    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schema}"."income_events" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "income_id" uuid NULL
            REFERENCES "${schema}"."vehicle_incomes"("id") ON DELETE SET NULL,
          "actor_user_id" uuid NULL,
          "actor_role" varchar NULL,
          "action" varchar NOT NULL,
          "reason" text NULL,
          "before" jsonb NULL,
          "after" jsonb NULL,
          "created_at" timestamptz NOT NULL DEFAULT now()
        )`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "idx_income_events_income_id"
           ON "${schema}"."income_events" ("income_id", "created_at" DESC)`,
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
        `DROP INDEX IF EXISTS "${schema}"."idx_income_events_income_id"`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schema}"."income_events"`,
      );
    }
  }
}
