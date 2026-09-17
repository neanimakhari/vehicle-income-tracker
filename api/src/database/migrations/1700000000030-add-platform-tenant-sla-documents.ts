import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformTenantSlaDocuments1700000000030 implements MigrationInterface {
  name = 'AddPlatformTenantSlaDocuments1700000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "platform"."tenant_sla_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "title" varchar NOT NULL,
        "file_name" varchar NOT NULL,
        "mime_type" varchar NOT NULL,
        "content_base64" text NOT NULL,
        "effective_from" date NULL DEFAULT NULL,
        "effective_to" date NULL DEFAULT NULL,
        "notes" text NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_tenant_sla_documents_tenant_id"
          FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "platform"."tenant_sla_documents"`,
    );
  }
}
