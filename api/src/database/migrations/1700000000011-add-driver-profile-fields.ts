import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriverProfileFields1700000000011 implements MigrationInterface {
  name = 'AddDriverProfileFields1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      
      // Add driver profile fields to users table
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "id_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "passport_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "date_of_birth" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "license_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "license_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "prdp_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "prdp_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "medical_certificate_expiry" date NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "bank_name" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "bank_account_number" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "bank_branch_code" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "account_holder_name" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "salary" numeric NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "address" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "emergency_contact_name" varchar NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "emergency_contact_phone" varchar NULL`,
      );

      // Create driver_documents table
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."driver_documents" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL,
          "document_type" varchar NOT NULL,
          "file_name" varchar NOT NULL,
          "file_path" varchar NOT NULL,
          "file_size" int NOT NULL,
          "mime_type" varchar NOT NULL,
          "uploaded_by" varchar NULL,
          "notes" text NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "FK_driver_documents_user_id" FOREIGN KEY ("user_id") REFERENCES "${schemaName}"."users"("id") ON DELETE CASCADE
        )`,
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
        `DROP TABLE IF EXISTS "${schemaName}"."driver_documents"`,
      );
      
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "emergency_contact_phone"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "emergency_contact_name"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "address"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "salary"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "account_holder_name"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "bank_branch_code"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "bank_account_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "bank_name"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "medical_certificate_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "prdp_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "prdp_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "license_expiry"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "license_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "date_of_birth"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "passport_number"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schemaName}"."users" DROP COLUMN IF EXISTS "id_number"`,
      );
    }
  }
}

