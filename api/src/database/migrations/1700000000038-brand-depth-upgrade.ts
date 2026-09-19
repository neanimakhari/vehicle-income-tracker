import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Brand depth: store logo/login-bg as base64 in DB, add font/radius/density/dark tokens.
 * Migrates existing filesystem assets into base64 columns when files are present.
 */
export class BrandDepthUpgrade1700000000038 implements MigrationInterface {
  name = 'BrandDepthUpgrade1700000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform"."tenants"
        ADD COLUMN IF NOT EXISTS "brand_logo_data" text NULL,
        ADD COLUMN IF NOT EXISTS "brand_login_bg_data" text NULL,
        ADD COLUMN IF NOT EXISTS "brand_font_family" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_border_radius" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_density" varchar NULL,
        ADD COLUMN IF NOT EXISTS "brand_primary_dark_hex" varchar(7) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "platform"."brand_kits"
        ADD COLUMN IF NOT EXISTS "logo_data" text NULL,
        ADD COLUMN IF NOT EXISTS "login_bg_data" text NULL
    `);

    // Migrate tenant logo files → base64
    const tenants: Array<{
      id: string;
      brand_logo_path: string | null;
      brand_logo_mime: string | null;
      brand_login_bg_path: string | null;
      brand_login_bg_mime: string | null;
    }> = await queryRunner.query(`
      SELECT id, brand_logo_path, brand_logo_mime, brand_login_bg_path, brand_login_bg_mime
      FROM "platform"."tenants"
      WHERE brand_logo_path IS NOT NULL OR brand_login_bg_path IS NOT NULL
    `);

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    for (const t of tenants) {
      const updates: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (t.brand_logo_path) {
        const abs = path.join(uploadsRoot, t.brand_logo_path);
        if (fs.existsSync(abs)) {
          const b64 = fs.readFileSync(abs).toString('base64');
          updates.push(`brand_logo_data = $${i++}`);
          params.push(b64);
        }
      }
      if (t.brand_login_bg_path) {
        const abs = path.join(uploadsRoot, t.brand_login_bg_path);
        if (fs.existsSync(abs)) {
          const b64 = fs.readFileSync(abs).toString('base64');
          updates.push(`brand_login_bg_data = $${i++}`);
          params.push(b64);
        }
      }
      if (updates.length) {
        params.push(t.id);
        await queryRunner.query(
          `UPDATE "platform"."tenants" SET ${updates.join(', ')} WHERE id = $${i}`,
          params,
        );
      }
    }

    const kits: Array<{
      id: string;
      logo_path: string | null;
      login_bg_path: string | null;
    }> = await queryRunner.query(`
      SELECT id, logo_path, login_bg_path FROM "platform"."brand_kits"
      WHERE logo_path IS NOT NULL OR login_bg_path IS NOT NULL
    `);
    for (const k of kits) {
      const updates: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (k.logo_path) {
        const abs = path.join(uploadsRoot, k.logo_path);
        if (fs.existsSync(abs)) {
          updates.push(`logo_data = $${i++}`);
          params.push(fs.readFileSync(abs).toString('base64'));
        }
      }
      if (k.login_bg_path) {
        const abs = path.join(uploadsRoot, k.login_bg_path);
        if (fs.existsSync(abs)) {
          updates.push(`login_bg_data = $${i++}`);
          params.push(fs.readFileSync(abs).toString('base64'));
        }
      }
      if (updates.length) {
        params.push(k.id);
        await queryRunner.query(
          `UPDATE "platform"."brand_kits" SET ${updates.join(', ')} WHERE id = $${i}`,
          params,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "platform"."tenants"
        DROP COLUMN IF EXISTS "brand_logo_data",
        DROP COLUMN IF EXISTS "brand_login_bg_data",
        DROP COLUMN IF EXISTS "brand_font_family",
        DROP COLUMN IF EXISTS "brand_border_radius",
        DROP COLUMN IF EXISTS "brand_density",
        DROP COLUMN IF EXISTS "brand_primary_dark_hex"
    `);
    await queryRunner.query(`
      ALTER TABLE "platform"."brand_kits"
        DROP COLUMN IF EXISTS "logo_data",
        DROP COLUMN IF EXISTS "login_bg_data"
    `);
  }
}
