import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfilePictureText1700000000018 implements MigrationInterface {
  name = 'ProfilePictureText1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ALTER COLUMN "profile_picture" TYPE text USING "profile_picture"::text`,
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
        `ALTER TABLE "${schemaName}"."users" ALTER COLUMN "profile_picture" TYPE varchar(255) USING LEFT("profile_picture", 255)`,
      );
    }
  }
}

