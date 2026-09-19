import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantReportsService } from './tenant-reports.service';
import { EmailService } from '../email/email.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { BrandService } from '../tenants/brand.service';
import { letterheadFromPolicy } from '../tenants/brand.util';

@Injectable()
export class MonthlyReportSchedulerService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantReportsService: TenantReportsService,
    private readonly emailService: EmailService,
    private readonly tenantContext: TenantContextService,
    private readonly brandService: BrandService,
  ) {}

  // Run on the 1st of every month at 9:00 AM
  @Cron('0 9 1 * *')
  async sendMonthlyReports() {
    console.log('Starting monthly report generation...');

    const tenants = await this.dataSource
      .getRepository(Tenant)
      .find({ where: { isActive: true } });

    for (const tenant of tenants) {
      try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        await new Promise<void>((resolve, reject) => {
          this.tenantContext.run(tenant.slug, () => {
            (async () => {
              try {
                const reportData =
                  await this.tenantReportsService.getMonthlyReport(
                    startDate,
                    endDate,
                  );
                const recipients =
                  await this.tenantReportsService.resolveMonthlyReportRecipients(
                    tenant.slug,
                  );
                if (!recipients.length) {
                  console.warn(
                    `No recipients for tenant ${tenant.slug}, skipping monthly report email`,
                  );
                  resolve();
                  return;
                }

                const pdf =
                  await this.tenantReportsService.buildMonthlyReportPdfBuffer(
                    reportData,
                    tenant.name || tenant.slug,
                  );
                const fileName = `monthly-report-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}.pdf`;

                const policy = await this.brandService.policyForSlug(tenant.slug);
                const letterhead = letterheadFromPolicy(
                  policy,
                  tenant.name || tenant.slug,
                );

                await this.emailService.sendMonthlyReport(
                  recipients,
                  tenant.name || tenant.slug,
                  reportData,
                  { filename: fileName, content: pdf },
                  {
                    displayName: letterhead.displayName,
                    primaryColor: letterhead.primaryColor,
                    accentColor: letterhead.accentColor,
                  },
                );

                console.log(
                  `Monthly report sent for tenant: ${tenant.slug} to ${recipients.join(', ')}`,
                );
                resolve();
              } catch (error) {
                reject(error);
              }
            })();
          });
        });
      } catch (error) {
        console.error(
          `Error sending monthly report for tenant ${tenant.slug}:`,
          error,
        );
      }
    }

    console.log('Monthly report generation completed');
  }
}
