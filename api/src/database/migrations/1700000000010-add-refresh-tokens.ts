import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokens1700000000010 implements MigrationInterface {
  name = 'AddRefreshTokens1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token_id" varchar NOT NULL UNIQUE,
        "user_id" varchar NOT NULL,
        "user_role" varchar NOT NULL,
        "tenant_id" varchar NULL,
        "is_revoked" boolean NOT NULL DEFAULT false,
        "replaced_by_token_id" varchar NULL,
        "expires_at" timestamptz NOT NULL,
        "last_used_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."refresh_tokens"`,
    );
  }
}

