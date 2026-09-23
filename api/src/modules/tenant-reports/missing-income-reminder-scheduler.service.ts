import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantIncomesService } from '../tenant-incomes/tenant-incomes.service';
import { TenantReportsService } from './tenant-reports.service';
import { EmailService } from '../email/email.service';
import { BrandService } from '../tenants/brand.service';
import { letterheadFromPolicy } from '../tenants/brand.util';

/** Sentinel user_id for admin digest rows in missing_income_reminder_logs. */
const ADMIN_DIGEST_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class MissingIncomeReminderSchedulerService {
  private readonly logger = new Logger(MissingIncomeReminderSchedulerService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly tenantIncomesService: TenantIncomesService,
    private readonly tenantReportsService: TenantReportsService,
    private readonly emailService: EmailService,
    private readonly brandService: BrandService,
  ) {}

  /** Every 15 minutes: cutoff reminders + next-morning escalations per tenant TZ. */
  @Cron('*/15 * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.dataSource
        .getRepository(Tenant)
        .find({ where: { isActive: true } });

      for (const tenant of tenants) {
        if (!tenant.missingIncomeReminderEnabled) continue;
        try {
          await this.tenantContext.runAsync(tenant.slug, async () => {
            await this.processTenant(tenant);
          });
        } catch (err) {
          this.logger.warn(
            `Missing-income reminders failed for ${tenant.slug}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async processTenant(tenant: Tenant) {
    const timezone = tenant.missingIncomeTimezone || 'Africa/Johannesburg';
    const nowParts = this.localParts(timezone);
    const today = nowParts.date;
    const hour = nowParts.hour;

    const cutoffHour = Number(tenant.missingIncomeCutoffHour ?? 21);
    const escalationHour = Number(tenant.missingIncomeEscalationHour ?? 8);

    if (hour >= cutoffHour) {
      await this.sendPhase(tenant, today, 'cutoff', timezone);
    }

    if (tenant.missingIncomeEscalationEnabled && hour >= escalationHour) {
      const yesterday = this.addDays(today, -1);
      await this.sendPhase(tenant, yesterday, 'escalation', timezone);
    }
  }

  private async sendPhase(
    tenant: Tenant,
    reminderDate: string,
    reminderType: 'cutoff' | 'escalation',
    timezone: string,
  ) {
    const missing = await this.tenantIncomesService.findMissingVehicles(reminderDate);
    if (!missing.missingCount || !missing.vehicles.length) return;

    let brand: {
      displayName?: string;
      primaryColor?: string;
      accentColor?: string;
      logoUrl?: string;
    } | null = null;
    try {
      const policy = await this.brandService.policyForSlug(tenant.slug);
      const lh = letterheadFromPolicy(policy, tenant.name || tenant.slug);
      brand = {
        displayName: lh.displayName,
        primaryColor: lh.primaryColor,
        accentColor: lh.accentColor,
        logoUrl: lh.logoUrl,
      };
    } catch {
      /* VIT defaults */
    }

    const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
    const drivers: Array<{ id: string; email: string; first_name: string }> =
      await this.dataSource.query(
        `
        SELECT id, email, first_name
        FROM "${schema}"."users"
        WHERE is_active = true
          AND email IS NOT NULL
          AND TRIM(email) <> ''
        `,
      );

    for (const driver of drivers) {
      const claimed = await this.claimLog(
        tenant.slug,
        driver.id,
        reminderDate,
        reminderType,
      );
      if (!claimed) continue;
      try {
        await this.emailService.sendMissingIncomeReminder({
          to: driver.email,
          tenantName: tenant.name || tenant.slug,
          reminderDate,
          reminderType,
          vehicles: missing.vehicles,
          brand,
        });
      } catch (err) {
        this.logger.warn(
          `Driver reminder failed ${tenant.slug}/${driver.email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const adminClaimed = await this.claimLog(
      tenant.slug,
      ADMIN_DIGEST_USER_ID,
      reminderDate,
      reminderType,
    );
    if (adminClaimed) {
      const recipients =
        await this.tenantReportsService.resolveMonthlyReportRecipients(
          tenant.slug,
        );
      if (recipients.length) {
        try {
          await this.emailService.sendMissingIncomeReminder({
            to: recipients,
            tenantName: tenant.name || tenant.slug,
            reminderDate,
            reminderType,
            vehicles: missing.vehicles,
            brand,
          });
        } catch (err) {
          this.logger.warn(
            `Admin digest failed ${tenant.slug}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    this.logger.log(
      `${reminderType} missing-income for ${tenant.slug} date=${reminderDate} tz=${timezone} vehicles=${missing.missingCount}`,
    );
  }

  private async claimLog(
    tenantSlug: string,
    userId: string,
    reminderDate: string,
    reminderType: string,
  ): Promise<boolean> {
    const inserted = await this.dataSource.query(
      `
      INSERT INTO "platform"."missing_income_reminder_logs"
        ("tenant_slug", "user_id", "reminder_date", "reminder_type")
      VALUES ($1, $2::uuid, $3::date, $4)
      ON CONFLICT ("tenant_slug", "user_id", "reminder_date", "reminder_type")
      DO NOTHING
      RETURNING id
      `,
      [tenantSlug, userId, reminderDate, reminderType],
    );
    return Array.isArray(inserted) && inserted.length > 0;
  }

  private localParts(timezone: string): { date: string; hour: number } {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    // en-US hour12:false can yield "24" for midnight in some engines — normalize
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0;
    return { date, hour };
  }

  private addDays(isoDate: string, delta: number): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    return dt.toISOString().slice(0, 10);
  }
}
