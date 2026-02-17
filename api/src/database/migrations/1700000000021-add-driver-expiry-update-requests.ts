import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriverExpiryUpdateRequests1700000000021 implements MigrationInterface {
  name = 'AddDriverExpiryUpdateRequests1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    ) as { slug: string }[];

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}"."driver_expiry_update_requests" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL,
          "status" varchar(20) NOT NULL DEFAULT 'pending',
          "requested_license_expiry" date NULL,
          "requested_prdp_expiry" date NULL,
          "requested_medical_certificate_expiry" date NULL,
          "supporting_document_ids" jsonb NULL,
          "submitted_at" timestamptz NOT NULL DEFAULT now(),
          "reviewed_at" timestamptz NULL,
          "reviewed_by" uuid NULL,
          "rejection_reason" text NULL
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    ) as { slug: string }[];

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      await queryRunner.query(
        `DROP TABLE IF EXISTS "${schemaName}"."driver_expiry_update_requests"`,
      );
    }
  }
}

