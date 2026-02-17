import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSecurityFields1700000000007 implements MigrationInterface {
  name = 'AddAuthSecurityFields1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" int NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "last_login_ip" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "last_login_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "last_login_ip"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "locked_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "failed_login_attempts"`,
    );
  }
}

