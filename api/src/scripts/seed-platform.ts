import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from '../database/data-source';
import { AuthUser } from '../auth/auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { TenantSchemasService } from '../modules/tenants/tenants.schemas.service';

type SeedConfig = {
  tenantName: string;
  tenantSlug: string;
  platformAdminEmail: string;
  platformAdminPassword: string;
  tenantAdminEmail: string;
  tenantAdminPassword: string;
  driverEmail: string;
  driverPassword: string;
};

const config: SeedConfig = {
  tenantName: process.env.SEED_TENANT_NAME ?? 'VIT Demo',
  tenantSlug: process.env.SEED_TENANT_SLUG ?? 'demo',
  platformAdminEmail:
    process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'platform.admin@vit.local',
  platformAdminPassword:
    process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!',
  tenantAdminEmail:
    process.env.SEED_TENANT_ADMIN_EMAIL ?? 'tenant.admin@vit.local',
  tenantAdminPassword:
    process.env.SEED_TENANT_ADMIN_PASSWORD ?? 'ChangeMe123!',
  driverEmail: process.env.SEED_DRIVER_EMAIL ?? 'driver.demo@vit.local',
  driverPassword: process.env.SEED_DRIVER_PASSWORD ?? 'ChangeMe123!',
};

async function seed() {
  await dataSource.initialize();
  const tenantRepo = dataSource.getRepository(Tenant);
  const authRepo = dataSource.getRepository(AuthUser);
  const tenantSchemas = new TenantSchemasService(dataSource);

  let tenant = await tenantRepo.findOne({ where: { slug: config.tenantSlug } });
  if (!tenant) {
    tenant = tenantRepo.create({
      name: config.tenantName,
      slug: config.tenantSlug,
      isActive: true,
    });
    tenant = await tenantRepo.save(tenant);
    await tenantSchemas.ensureTenantSchema(config.tenantSlug);
    console.log(`Created tenant ${tenant.slug}`);
  } else {
    console.log(`Tenant ${tenant.slug} already exists`);
  }

  const platformAdmin = await authRepo.findOne({
    where: { email: config.platformAdminEmail },
  });
  if (!platformAdmin) {
    const passwordHash = await bcrypt.hash(config.platformAdminPassword, 12);
    await authRepo.save(
      authRepo.create({
        email: config.platformAdminEmail,
        passwordHash,
        role: 'PLATFORM_ADMIN',
        tenantId: null,
        isActive: true,
      }),
    );
    console.log(`Created platform admin ${config.platformAdminEmail}`);
  } else {
    console.log(`Platform admin ${config.platformAdminEmail} already exists`);
  }

  const tenantAdmin = await authRepo.findOne({
    where: { email: config.tenantAdminEmail },
  });
  if (!tenantAdmin) {
    const passwordHash = await bcrypt.hash(config.tenantAdminPassword, 12);
    await authRepo.save(
      authRepo.create({
        email: config.tenantAdminEmail,
        passwordHash,
        role: 'TENANT_ADMIN',
        tenantId: config.tenantSlug,
        isActive: true,
      }),
    );
    console.log(`Created tenant admin ${config.tenantAdminEmail}`);
  } else {
    console.log(`Tenant admin ${config.tenantAdminEmail} already exists`);
  }

  // Demo driver for mobile app login (tenant slug = demo, email = driver.demo@vit.local)
  const schemaName = `tenant_${config.tenantSlug.replace(/-/g, '_')}`;
  const existingDriver = await dataSource.query(
    `SELECT 1 FROM "${schemaName}"."users" WHERE email = $1 LIMIT 1`,
    [config.driverEmail],
  );
  if (!existingDriver || existingDriver.length === 0) {
    const driverPasswordHash = await bcrypt.hash(config.driverPassword, 12);
    await dataSource.query(
      `INSERT INTO "${schemaName}"."users" (first_name, last_name, email, password_hash, is_active, email_verified)
       VALUES ($1, $2, $3, $4, true, true)`,
      ['Driver', 'Demo', config.driverEmail, driverPasswordHash],
    );
    console.log(`Created demo driver ${config.driverEmail}`);
  } else {
    console.log(`Demo driver ${config.driverEmail} already exists`);
  }

  await dataSource.destroy();
  console.log('Seed complete.');
}

seed().catch(error => {
  console.error(error);
  dataSource
    .destroy()
    .catch(() => undefined)
    .finally(() => process.exit(1));
});


