import 'dotenv/config';
import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'vit_platform',
  schema: process.env.DB_DEFAULT_SCHEMA ?? 'platform',
});

async function updateTenantSchemas() {
  await dataSource.initialize();
  
  try {
    // Get all tenants
    const tenants = await dataSource.query(
      `SELECT "slug" FROM "platform"."tenants"`,
    );

    console.log(`Found ${tenants.length} tenant(s) to update`);

    for (const tenant of tenants) {
      const schemaName = `tenant_${String(tenant.slug).replace(/-/g, '_')}`;
      console.log(`Updating schema: ${schemaName}`);

      // Add driver profile fields to users table
      const columns = [
        { name: 'id_number', type: 'varchar' },
        { name: 'passport_number', type: 'varchar' },
        { name: 'date_of_birth', type: 'date' },
        { name: 'license_number', type: 'varchar' },
        { name: 'license_expiry', type: 'date' },
        { name: 'prdp_number', type: 'varchar' },
        { name: 'prdp_expiry', type: 'date' },
        { name: 'medical_certificate_expiry', type: 'date' },
        { name: 'bank_name', type: 'varchar' },
        { name: 'bank_account_number', type: 'varchar' },
        { name: 'bank_branch_code', type: 'varchar' },
        { name: 'account_holder_name', type: 'varchar' },
        { name: 'salary', type: 'numeric' },
        { name: 'address', type: 'text' },
        { name: 'emergency_contact_name', type: 'varchar' },
        { name: 'emergency_contact_phone', type: 'varchar' },
      ];

      for (const col of columns) {
        try {
          await dataSource.query(
            `ALTER TABLE "${schemaName}"."users" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type} NULL`,
          );
          console.log(`  ✓ Added column: ${col.name}`);
        } catch (error) {
          console.log(`  ✗ Failed to add column ${col.name}: ${error}`);
        }
      }

      // Create driver_documents table
      try {
        await dataSource.query(
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
        console.log(`  ✓ Created driver_documents table`);
      } catch (error) {
        console.log(`  ✗ Failed to create driver_documents table: ${error}`);
      }
    }

    console.log('\n✓ All tenant schemas updated successfully!');
  } catch (error) {
    console.error('Error updating tenant schemas:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

updateTenantSchemas();

