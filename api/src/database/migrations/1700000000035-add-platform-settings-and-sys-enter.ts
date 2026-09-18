import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformSettingsAndSysEnter1700000000035
  implements MigrationInterface
{
  name = 'AddPlatformSettingsAndSysEnter1700000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform.platform_settings (
        key varchar(64) PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO platform.platform_settings (key, value)
      VALUES
        (
          'new_tenant_defaults',
          '{"recommendMfa":true,"recommendDriverMfa":true,"recommendBiometrics":false,"maxDrivers":null,"maxStorageMb":null,"defaultPlanCode":null}'::jsonb
        ),
        (
          'announcement',
          '{"enabled":false,"severity":"info","message":"","startsAt":null,"endsAt":null,"blockWrites":false}'::jsonb
        )
      ON CONFLICT (key) DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE platform.tenants
      ADD COLUMN IF NOT EXISTS allow_sys_enter boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE platform.tenants DROP COLUMN IF EXISTS allow_sys_enter
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS platform.platform_settings`);
  }
}
