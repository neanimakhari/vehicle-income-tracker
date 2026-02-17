import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthUserPasswordReset1700000000016 implements MigrationInterface {
  name = 'AddAuthUserPasswordReset1700000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "password_reset_token" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" ADD COLUMN IF NOT EXISTS "password_reset_expires" timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "password_reset_expires"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform"."auth_users" DROP COLUMN IF EXISTS "password_reset_token"`,
    );
  }
}
