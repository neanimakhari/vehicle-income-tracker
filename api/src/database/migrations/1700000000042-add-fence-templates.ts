import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-tenant reusable fence templates (geometry blueprints).
 * Created via ensureTables as well; this migration documents the shape for ops.
 */
export class AddFenceTemplates1700000000042 implements MigrationInterface {
  name = 'AddFenceTemplates1700000000042';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Tenant schemas are provisioned by GeofenceService.ensureTables at runtime.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
