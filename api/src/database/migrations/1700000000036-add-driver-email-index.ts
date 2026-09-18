import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriverEmailIndex1700000000036 implements MigrationInterface {
  name = 'AddDriverEmailIndex1700000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform.driver_email_index (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email_normalized varchar(320) NOT NULL,
        tenant_slug varchar(64) NOT NULL,
        user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_driver_email_index_email_tenant UNIQUE (email_normalized, tenant_slug)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_driver_email_index_email
      ON platform.driver_email_index (email_normalized)
    `);

    // Backfill from existing tenant_* schemas that have a users table with email.
    const schemas: Array<{ schema_name: string }> = await queryRunner.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);

    for (const row of schemas) {
      const schema = row.schema_name;
      const slug = schema.replace(/^tenant_/, '').replace(/_/g, '-');
      const tables: Array<{ table_name: string }> = await queryRunner.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'users'
        `,
        [schema],
      );
      if (!tables.length) continue;

      await queryRunner.query(
        `
        INSERT INTO platform.driver_email_index (email_normalized, tenant_slug, user_id)
        SELECT lower(trim(u.email)), $1, u.id
        FROM "${schema}".users u
        WHERE u.email IS NOT NULL AND trim(u.email) <> ''
        ON CONFLICT (email_normalized, tenant_slug) DO UPDATE
          SET user_id = EXCLUDED.user_id,
              updated_at = now()
        `,
        [slug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS platform.driver_email_index`);
  }
}
