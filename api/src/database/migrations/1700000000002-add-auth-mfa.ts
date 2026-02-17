import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthMfa1700000000002 implements MigrationInterface {
  name = 'AddAuthMfa1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "mfa_secret" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "mfa_secret"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "mfa_enabled"`,
    );
  }
}


