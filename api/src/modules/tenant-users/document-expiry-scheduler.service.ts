import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { CommercialService } from '../commercial/commercial.service';
import { TenantNotificationsService } from '../tenant-notifications/tenant-notifications.service';
import { EmailService } from '../email/email.service';
import { AuthUser } from '../../auth/auth-user.entity';

type DocKind = 'license' | 'prdp' | 'medical';

const THRESHOLDS = [30, 14, 7, 1, 0] as const;

/**
 * Daily: remind drivers + tenant admins about licence / PRDP / medical expiry.
 * Channels v1: in-app + OneSignal push + email (no WhatsApp/SMS).
 */
@Injectable()
export class DocumentExpirySchedulerService {
  private readonly logger = new Logger(DocumentExpirySchedulerService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly commercial: CommercialService,
    private readonly notifications: TenantNotificationsService,
    private readonly email: EmailService,
  ) {}

  /** 07:30 — after maintenance tick */
  @Cron('30 7 * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.dataSource
        .getRepository(Tenant)
        .find({ where: { isActive: true } });
      for (const tenant of tenants) {
        try {
          if (!(await this.commercial.hasModule(tenant.slug, 'notifications'))) {
            continue;
          }
          await this.tenantContext.runAsync(tenant.slug, async () => {
            await this.processTenant(tenant);
          });
        } catch (err) {
          this.logger.warn(
            `Document expiry alerts failed for ${tenant.slug}: ${
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
    const schema = `tenant_${tenant.slug.replace(/-/g, '_')}`;
    const drivers: Array<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      license_expiry: Date | string | null;
      prdp_expiry: Date | string | null;
      medical_certificate_expiry: Date | string | null;
    }> = await this.dataSource.query(
      `SELECT id, email, first_name, last_name,
              license_expiry, prdp_expiry, medical_certificate_expiry
       FROM "${schema}"."users"
       WHERE is_active = true`,
    );

    const today = this.startOfUtcDay(new Date());
    const adminEmails = await this.adminEmails(tenant.slug);

    for (const d of drivers) {
      const name = `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim() || d.email;
      await this.maybeNotify({
        tenant,
        driverId: d.id,
        driverName: name,
        driverEmail: d.email,
        kind: 'license',
        label: 'Driving licence',
        expiry: d.license_expiry,
        today,
        adminEmails,
      });
      await this.maybeNotify({
        tenant,
        driverId: d.id,
        driverName: name,
        driverEmail: d.email,
        kind: 'prdp',
        label: 'PrDP',
        expiry: d.prdp_expiry,
        today,
        adminEmails,
      });
      await this.maybeNotify({
        tenant,
        driverId: d.id,
        driverName: name,
        driverEmail: d.email,
        kind: 'medical',
        label: 'Medical certificate',
        expiry: d.medical_certificate_expiry,
        today,
        adminEmails,
      });
    }
  }

  private async maybeNotify(opts: {
    tenant: Tenant;
    driverId: string;
    driverName: string;
    driverEmail: string;
    kind: DocKind;
    label: string;
    expiry: Date | string | null;
    today: Date;
    adminEmails: string[];
  }) {
    if (!opts.expiry) return;
    const exp = this.startOfUtcDay(new Date(opts.expiry));
    if (Number.isNaN(exp.getTime())) return;
    const days = Math.round(
      (exp.getTime() - opts.today.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (!THRESHOLDS.includes(days as (typeof THRESHOLDS)[number]) && days > 0) {
      return;
    }
    // overdue: fire once at days<=0 using threshold 0 bucket (dedupeKey uses 0)
    const bucket = days <= 0 ? 0 : days;
    if (!THRESHOLDS.includes(bucket as (typeof THRESHOLDS)[number])) return;

    const when =
      days < 0
        ? `expired ${Math.abs(days)} day(s) ago`
        : days === 0
          ? 'expires today'
          : `expires in ${days} day(s)`;
    const title =
      days <= 0
        ? `${opts.label} expired — ${opts.driverName}`
        : `${opts.label} ${when} — ${opts.driverName}`;
    const message = `${opts.driverName}'s ${opts.label.toLowerCase()} ${when} (${exp.toISOString().slice(0, 10)}). Update documents to avoid fines.`;
    const dedupeKey = `doc_expiry:${opts.driverId}:${opts.kind}:${bucket}:${exp.toISOString().slice(0, 10)}`;

    await this.notifications.publish({
      title,
      message,
      targetUserId: opts.driverId,
      targetRole: 'TENANT_USER',
      source: 'document_expiry',
      deepLink: 'vitapp://alerts',
      meta: {
        dedupeKey: `${dedupeKey}:driver`,
        driverId: opts.driverId,
        kind: opts.kind,
        days,
      },
      push: true,
    });

    await this.notifications.publish({
      title,
      message,
      targetRole: 'TENANT_ADMIN',
      source: 'document_expiry',
      deepLink: 'vitapp://alerts',
      meta: {
        dedupeKey: `${dedupeKey}:admin`,
        driverId: opts.driverId,
        kind: opts.kind,
        days,
      },
      push: true,
    });

    const recipients = [
      ...(opts.driverEmail ? [opts.driverEmail] : []),
      ...opts.adminEmails,
    ];
    if (recipients.length) {
      try {
        await this.email.sendDocumentExpiryReminder({
          to: [...new Set(recipients)],
          tenantName: opts.tenant.name,
          driverName: opts.driverName,
          documentLabel: opts.label,
          expiryDate: exp.toISOString().slice(0, 10),
          daysRemaining: days,
        });
      } catch {
        /* ignore email failures */
      }
    }
  }

  private startOfUtcDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private async adminEmails(tenantSlug: string): Promise<string[]> {
    const admins = await this.dataSource.getRepository(AuthUser).find({
      where: {
        role: 'TENANT_ADMIN',
        tenantId: tenantSlug,
        isActive: true,
      },
      select: ['email'],
    });
    return admins.map((a) => a.email).filter(Boolean);
  }
}
