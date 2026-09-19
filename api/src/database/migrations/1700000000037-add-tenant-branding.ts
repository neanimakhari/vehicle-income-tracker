import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantBranding1700000000037 implements MigrationInterface {
  name = 'AddTenantBranding1700000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform"."tenants"
        ADD COLUMN IF NOT EXISTS "brand_mode" varchar NOT NULL DEFAULT 'vit_default',
        ADD COLUMN IF NOT EXISTS "brand_display_name" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_primary_hex" varchar(7) NULL,
        ADD COLUMN IF NOT EXISTS "brand_accent_hex" varchar(7) NULL,
        ADD COLUMN IF NOT EXISTS "brand_sidebar_style" varchar NOT NULL DEFAULT 'colored',
        ADD COLUMN IF NOT EXISTS "brand_logo_path" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_logo_mime" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_login_bg_path" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_login_bg_mime" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_draft_json" jsonb NULL,
        ADD COLUMN IF NOT EXISTS "brand_kit_id" uuid NULL,
        ADD COLUMN IF NOT EXISTS "brand_updated_at" timestamptz NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."brand_kits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text NULL,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "logo_path" varchar NULL,
        "logo_mime" varchar NULL,
        "login_bg_path" varchar NULL,
        "login_bg_mime" varchar NULL,
        "is_starter" boolean NOT NULL DEFAULT false,
        "created_by" varchar NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."tenant_brand_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_slug" varchar NOT NULL,
        "label" varchar NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_by" varchar NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tenant_brand_snapshots_slug"
       ON "platform"."tenant_brand_snapshots" ("tenant_slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform"."tenant_brand_preview_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token" varchar NOT NULL UNIQUE,
        "tenant_slug" varchar NULL,
        "kit_id" uuid NULL REFERENCES "platform"."brand_kits"("id") ON DELETE CASCADE,
        "source" varchar NOT NULL DEFAULT 'draft',
        "snapshot_id" uuid NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz NULL,
        "created_by" varchar NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "platform"."feature_modules" ("key", "name", "description", "sort_order")
      VALUES (
        'branding',
        'White-label branding',
        'Custom logo, colors, and display name across admin and driver app',
        90
      )
      ON CONFLICT ("key") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "platform"."plan_modules" ("plan_id", "module_key")
      SELECT p.id, 'branding'
      FROM "platform"."plans" p
      WHERE p.code IN ('fleet', 'pro')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "platform"."brand_kits"
        ("name", "description", "tags", "payload", "is_starter")
      VALUES
        (
          'VIT Teal',
          'Default Vehicle Income Tracker look',
          '["starter","vit"]'::jsonb,
          '{"primaryHex":"#0d9488","accentHex":"#134e4a","sidebarStyle":"colored","displayName":null}'::jsonb,
          true
        ),
        (
          'Neutral Grey',
          'Muted corporate palette',
          '["starter","corporate"]'::jsonb,
          '{"primaryHex":"#475569","accentHex":"#1e293b","sidebarStyle":"neutral","displayName":null}'::jsonb,
          true
        ),
        (
          'High Contrast Blue',
          'Strong primary for accessibility-minded fleets',
          '["starter","accessible"]'::jsonb,
          '{"primaryHex":"#1d4ed8","accentHex":"#1e3a8a","sidebarStyle":"colored","displayName":null}'::jsonb,
          true
        )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "platform"."plan_modules" WHERE "module_key" = 'branding'`,
    );
    await queryRunner.query(
      `DELETE FROM "platform"."feature_modules" WHERE "key" = 'branding'`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."tenant_brand_preview_tokens"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."tenant_brand_snapshots"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "platform"."brand_kits"`);
    await queryRunner.query(`
      ALTER TABLE "platform"."tenants"
        DROP COLUMN IF EXISTS "brand_mode",
        DROP COLUMN IF EXISTS "brand_display_name",
        DROP COLUMN IF EXISTS "brand_primary_hex",
        DROP COLUMN IF EXISTS "brand_accent_hex",
        DROP COLUMN IF EXISTS "brand_sidebar_style",
        DROP COLUMN IF EXISTS "brand_logo_path",
        DROP COLUMN IF EXISTS "brand_logo_mime",
        DROP COLUMN IF EXISTS "brand_login_bg_path",
        DROP COLUMN IF EXISTS "brand_login_bg_mime",
        DROP COLUMN IF EXISTS "brand_draft_json",
        DROP COLUMN IF EXISTS "brand_kit_id",
        DROP COLUMN IF EXISTS "brand_updated_at"
    `);
  }
}
