import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantReportsService } from './tenant-reports.service';
import { EmailService } from '../email/email.service';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantUser } from '../tenant-users/tenant-user.entity';

@Injectable()
export class MonthlyReportSchedulerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantReportsService: TenantReportsService,
    private readonly emailService: EmailService,
    private readonly tenantScope: TenantScopeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // Run on the 1st of every month at 9:00 AM
  @Cron('0 9 1 * *')
  async sendMonthlyReports() {
    console.log('Starting monthly report generation...');
    
    // Get all active tenants
    const tenants = await this.dataSource
      .getRepository(Tenant)
      .find({ where: { isActive: true } });

    for (const tenant of tenants) {
      try {
        // Calculate last month's date range
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        // Set tenant context using run method
        await new Promise<void>((resolve, reject) => {
          this.tenantContext.run(tenant.slug, () => {
            (async () => {
              try {
                // Generate report within tenant context
                const reportData = await this.tenantReportsService.getMonthlyReport(startDate, endDate);

                // Get tenant admin email from platform auth_users (TENANT_ADMIN for this tenant)
                const adminUsers = await this.dataSource.query(
                  `SELECT email FROM "platform"."auth_users" WHERE role = 'TENANT_ADMIN' AND tenant_id = $1 AND is_active = true LIMIT 1`,
                  [tenant.slug],
                );
                const adminEmail = adminUsers?.[0]?.email;
                if (!adminEmail) {
                  console.warn(`No tenant admin found for tenant ${tenant.slug}, skipping monthly report email`);
                  resolve();
                  return;
                }

                // Send email
                await this.emailService.sendMonthlyReport(
                  adminEmail,
                  tenant.name || tenant.slug,
                  reportData,
                );

                console.log(`Monthly report sent for tenant: ${tenant.slug} to ${adminEmail}`);
                resolve();
              } catch (error) {
                reject(error);
              }
            })();
          });
        });
      } catch (error) {
        console.error(`Error sending monthly report for tenant ${tenant.slug}:`, error);
      }
    }

    console.log('Monthly report generation completed');
  }
}

