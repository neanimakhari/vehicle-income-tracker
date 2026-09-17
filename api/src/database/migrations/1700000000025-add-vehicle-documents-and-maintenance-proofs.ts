import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleDocumentsAndMaintenanceProofs1700000000025 implements MigrationInterface {
  name = 'AddVehicleDocumentsAndMaintenanceProofs1700000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicles" ADD COLUMN IF NOT EXISTS "vehicle_documents" text NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."maintenance_tasks" ADD COLUMN IF NOT EXISTS "proofs" text NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ slug: string }> = await queryRunner.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    for (const tenant of tenants) {
      const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
      await queryRunner.query(
        `ALTER TABLE "${schema}"."maintenance_tasks" DROP COLUMN IF EXISTS "proofs"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${schema}"."vehicles" DROP COLUMN IF EXISTS "vehicle_documents"`,
      );
    }
  }
}
