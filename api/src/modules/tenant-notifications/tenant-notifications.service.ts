import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuthUser } from '../../auth/auth-user.entity';
import { DeviceBinding } from '../../auth/device-binding.entity';
import { OneSignalClient } from './onesignal.client';

export type NotificationCategoryDto = {
  id: string;
  name: string;
  description: string | null;
};

export type NotificationDto = {
  id: string;
  title: string;
  message: string;
  categoryId: string | null;
  targetRole: string | null;
  targetUserId: string | null;
  status: string;
  source: string;
  deepLink: string | null;
  meta: Record<string, unknown>;
  read: boolean;
  createdBy: string | null;
  createdAt: string;
  /** Present on admin `view=sent` list */
  audienceCount?: number;
  readCount?: number;
};

export type NotificationReaderDto = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: 'TENANT_USER' | 'TENANT_ADMIN' | 'UNKNOWN';
  readAt: string;
};

export type NotificationDeliveryStats = {
  notificationId: string;
  title: string;
  status: string;
  targetRole: string | null;
  audienceCount: number;
  readCount: number;
  unreadCount: number;
  reads: NotificationReaderDto[];
};

export type SendNotificationInput = {
  title: string;
  message: string;
  categoryId?: string | null;
  targetRole?: string | null;
  targetUserId?: string | null;
  source?: string;
  deepLink?: string | null;
  meta?: Record<string, unknown>;
  push?: boolean;
};

export type SendNotificationResult = {
  notification: NotificationDto;
  push: {
    configured: boolean;
    enabled: boolean;
    skipped: boolean;
    reason?: string;
    recipientCount: number;
    onesignalId?: string | null;
    errors?: string[];
  };
};

@Injectable()
export class TenantNotificationsService {
  private readonly logger = new Logger(TenantNotificationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly tenantContext: TenantContextService,
    private readonly oneSignal: OneSignalClient,
    @InjectRepository(AuthUser)
    private readonly authUsers: Repository<AuthUser>,
    @InjectRepository(DeviceBinding)
    private readonly deviceBindings: Repository<DeviceBinding>,
  ) {}

  async listCategories(): Promise<NotificationCategoryDto[]> {
    const schema = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `SELECT id, name, description
       FROM "${schema}"."notification_categories"
       ORDER BY name ASC`,
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description != null ? String(r.description) : null,
    }));
  }

  async createCategory(
    name: string,
    description: string | null,
  ): Promise<NotificationCategoryDto> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Name is required');
    const schema = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}"."notification_categories" (name, description, is_default)
       VALUES ($1, $2, false)
       RETURNING id, name, description`,
      [trimmed, description?.trim() || null],
    );
    const r = rows[0] as Record<string, unknown>;
    return {
      id: String(r.id),
      name: String(r.name),
      description: r.description != null ? String(r.description) : null,
    };
  }

  async listNotifications(opts?: {
    actorUserId?: string | null;
    actorRole?: string | null;
    limit?: number;
    /** `sent` = admin compose log with delivery/read counts; default = inbox */
    view?: 'inbox' | 'sent' | null;
  }): Promise<NotificationDto[]> {
    const schema = this.tenantScope.getTenantSchema();
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const role = opts?.actorRole ?? null;
    const userId = opts?.actorUserId ?? null;
    const view = opts?.view ?? 'inbox';

    if (view === 'sent' && role === 'TENANT_ADMIN') {
      const rows = await this.dataSource.query(
        `SELECT n.id, n.category_id, n.title, n.message, n.target_role, n.target_user_id,
                n.status, n.source, n.deep_link, n.meta, n.created_by, n.created_at,
                false AS is_read,
                (SELECT COUNT(*)::int FROM "${schema}"."notification_reads" r
                  WHERE r.notification_id = n.id) AS read_count
         FROM "${schema}"."notifications" n
         ORDER BY n.created_at DESC
         LIMIT $1`,
        [limit],
      );
      const tenantSlug = this.tenantContext.getTenantId();
      const driverCount = (await this.listDriverIds()).length;
      const adminCount = tenantSlug
        ? (await this.listTenantAdminIds(tenantSlug)).length
        : 0;
      return (rows as Record<string, unknown>[]).map((r) => {
        const dto = this.mapNotification(r);
        const tr = r.target_role != null ? String(r.target_role) : null;
        const tu = r.target_user_id != null ? String(r.target_user_id) : null;
        let audienceCount = 0;
        if (tu) audienceCount = 1;
        else if (tr === 'TENANT_USER') audienceCount = driverCount;
        else if (tr === 'TENANT_ADMIN') audienceCount = adminCount;
        else audienceCount = driverCount + adminCount;
        return {
          ...dto,
          audienceCount,
          readCount: Number(r.read_count ?? 0),
        };
      });
    }

    if (role === 'TENANT_USER' && userId) {
      const rows = await this.dataSource.query(
        `SELECT n.id, n.category_id, n.title, n.message, n.target_role, n.target_user_id,
                n.status, n.source, n.deep_link, n.meta, n.created_by, n.created_at,
                (r.read_at IS NOT NULL) AS is_read
         FROM "${schema}"."notifications" n
         LEFT JOIN "${schema}"."notification_reads" r
           ON r.notification_id = n.id AND r.user_id = $1
         WHERE (n.target_user_id IS NULL OR n.target_user_id = $1)
           AND (n.target_role IS NULL OR n.target_role = 'TENANT_USER')
           AND n.status <> 'pending'
         ORDER BY n.created_at DESC
         LIMIT $2`,
        [userId, limit],
      );
      return rows.map((r: Record<string, unknown>) => this.mapNotification(r));
    }

    if (role === 'TENANT_ADMIN' && userId) {
      const rows = await this.dataSource.query(
        `SELECT n.id, n.category_id, n.title, n.message, n.target_role, n.target_user_id,
                n.status, n.source, n.deep_link, n.meta, n.created_by, n.created_at,
                (r.read_at IS NOT NULL) AS is_read
         FROM "${schema}"."notifications" n
         LEFT JOIN "${schema}"."notification_reads" r
           ON r.notification_id = n.id AND r.user_id = $1
         WHERE (n.target_user_id IS NULL OR n.target_user_id = $1)
           AND (n.target_role IS NULL OR n.target_role = 'TENANT_ADMIN')
           AND n.status <> 'pending'
         ORDER BY n.created_at DESC
         LIMIT $2`,
        [userId, limit],
      );
      return rows.map((r: Record<string, unknown>) => this.mapNotification(r));
    }

    const rows = await this.dataSource.query(
      `SELECT id, category_id, title, message, target_role, target_user_id,
              status, source, deep_link, meta, created_by, created_at,
              false AS is_read
       FROM "${schema}"."notifications"
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r: Record<string, unknown>) => this.mapNotification(r));
  }

  async getDeliveryStats(
    notificationId: string,
  ): Promise<NotificationDeliveryStats> {
    const schema = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `SELECT id, title, status, target_role, target_user_id
       FROM "${schema}"."notifications"
       WHERE id = $1
       LIMIT 1`,
      [notificationId],
    );
    if (!rows.length) throw new NotFoundException('Notification not found');
    const n = rows[0] as Record<string, unknown>;
    const targetRole = n.target_role != null ? String(n.target_role) : null;
    const targetUserId =
      n.target_user_id != null ? String(n.target_user_id) : null;
    const audienceCount = await this.audienceCountFor(targetRole, targetUserId);

    const readRows = await this.dataSource.query(
      `SELECT r.user_id, r.read_at
       FROM "${schema}"."notification_reads" r
       WHERE r.notification_id = $1
       ORDER BY r.read_at ASC`,
      [notificationId],
    );
    const reads = await this.enrichReaders(
      (readRows as { user_id: string; read_at: Date | string }[]).map((r) => ({
        userId: String(r.user_id),
        readAt:
          r.read_at instanceof Date
            ? r.read_at.toISOString()
            : String(r.read_at),
      })),
    );
    const readCount = reads.length;
    return {
      notificationId: String(n.id),
      title: String(n.title),
      status: String(n.status ?? 'sent'),
      targetRole,
      audienceCount,
      readCount,
      unreadCount: Math.max(0, audienceCount - readCount),
      reads,
    };
  }

  private async audienceCountFor(
    targetRole: string | null,
    targetUserId: string | null,
  ): Promise<number> {
    try {
      const { externalIds } = await this.resolveRecipients(
        targetRole,
        targetUserId,
      );
      return externalIds.length;
    } catch {
      return 0;
    }
  }

  private async enrichReaders(
    rows: { userId: string; readAt: string }[],
  ): Promise<NotificationReaderDto[]> {
    if (!rows.length) return [];
    const schema = this.tenantScope.getTenantSchema();
    const ids = rows.map((r) => r.userId);
    const drivers = await this.dataSource.query(
      `SELECT id, first_name, last_name, email
       FROM "${schema}"."users"
       WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const driverMap = new Map(
      (drivers as Record<string, unknown>[]).map((d) => [
        String(d.id),
        {
          displayName: `${String(d.first_name ?? '')} ${String(d.last_name ?? '')}`.trim() || null,
          email: d.email != null ? String(d.email) : null,
          role: 'TENANT_USER' as const,
        },
      ]),
    );
    const missing = ids.filter((id) => !driverMap.has(id));
    const adminMap = new Map<
      string,
      { displayName: string | null; email: string | null; role: 'TENANT_ADMIN' }
    >();
    if (missing.length) {
      const admins = await this.authUsers.find({
        where: { id: In(missing) },
        select: ['id', 'email'],
      });
      for (const a of admins) {
        adminMap.set(a.id, {
          displayName: a.email ?? null,
          email: a.email ?? null,
          role: 'TENANT_ADMIN',
        });
      }
    }
    return rows.map((r) => {
      const info =
        driverMap.get(r.userId) ??
        adminMap.get(r.userId) ?? {
          displayName: null,
          email: null,
          role: 'UNKNOWN' as const,
        };
      return {
        userId: r.userId,
        displayName: info.displayName,
        email: info.email,
        role: info.role,
        readAt: r.readAt,
      };
    });
  }

  async unreadCount(actorUserId: string, actorRole: string): Promise<number> {
    const schema = this.tenantScope.getTenantSchema();
    const roleFilter =
      actorRole === 'TENANT_ADMIN'
        ? `(target_role IS NULL OR target_role = 'TENANT_ADMIN')`
        : `(target_role IS NULL OR target_role = 'TENANT_USER')`;
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS c
       FROM "${schema}"."notifications" n
       WHERE (n.target_user_id IS NULL OR n.target_user_id = $1)
         AND ${roleFilter}
         AND n.status <> 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM "${schema}"."notification_reads" r
           WHERE r.notification_id = n.id AND r.user_id = $1
         )`,
      [actorUserId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async markRead(notificationId: string, actorUserId: string): Promise<{ ok: true }> {
    const schema = this.tenantScope.getTenantSchema();
    const exists = await this.dataSource.query(
      `SELECT 1 FROM "${schema}"."notifications" WHERE id = $1 LIMIT 1`,
      [notificationId],
    );
    if (!exists.length) throw new NotFoundException('Notification not found');
    await this.dataSource.query(
      `INSERT INTO "${schema}"."notification_reads" (notification_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [notificationId, actorUserId],
    );
    return { ok: true };
  }

  async markAllRead(actorUserId: string, actorRole: string): Promise<{ ok: true; count: number }> {
    const schema = this.tenantScope.getTenantSchema();
    const roleFilter =
      actorRole === 'TENANT_ADMIN'
        ? `(target_role IS NULL OR target_role = 'TENANT_ADMIN')`
        : `(target_role IS NULL OR target_role = 'TENANT_USER')`;
    const result = await this.dataSource.query(
      `INSERT INTO "${schema}"."notification_reads" (notification_id, user_id)
       SELECT n.id, $1
       FROM "${schema}"."notifications" n
       WHERE (n.target_user_id IS NULL OR n.target_user_id = $1)
         AND ${roleFilter}
         AND n.status <> 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM "${schema}"."notification_reads" r
           WHERE r.notification_id = n.id AND r.user_id = $1
         )`,
      [actorUserId],
    );
    const count = Array.isArray(result) ? result.length : Number(result?.rowCount ?? 0);
    return { ok: true, count };
  }

  /**
   * Unified publish path for admin compose + auto-alerts.
   * Skips insert when meta.dedupeKey already exists in the last 24h.
   */
  async publish(
    input: SendNotificationInput,
    actorUserId: string | null = null,
  ): Promise<SendNotificationResult | null> {
    const title = input.title?.trim();
    const message = input.message?.trim();
    if (!title || !message) {
      throw new BadRequestException('Title and message are required');
    }

    const targetRole = this.normalizeRole(input.targetRole);
    const categoryId = input.categoryId?.trim() || null;
    const targetUserId = input.targetUserId?.trim() || null;
    const source = (input.source ?? 'manual').trim() || 'manual';
    const deepLink = input.deepLink?.trim() || null;
    const meta = input.meta ?? {};
    const wantPush = input.push !== false;

    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const schema = this.tenantScope.getTenantSchema();
    const dedupeKey =
      typeof meta.dedupeKey === 'string' ? meta.dedupeKey : null;
    if (dedupeKey) {
      const dup = await this.dataSource.query(
        `SELECT id FROM "${schema}"."notifications"
         WHERE meta->>'dedupeKey' = $1
           AND created_at > now() - interval '24 hours'
         LIMIT 1`,
        [dedupeKey],
      );
      if (dup.length) {
        this.logger.debug(`Skip duplicate notification dedupeKey=${dedupeKey}`);
        return null;
      }
    }

    const inserted = await this.dataSource.query(
      `INSERT INTO "${schema}"."notifications"
         (category_id, title, message, target_role, target_user_id, status,
          source, deep_link, meta, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
       RETURNING id, category_id, title, message, target_role, target_user_id,
                 status, source, deep_link, meta, created_by, created_at`,
      [
        categoryId,
        title,
        message,
        targetRole,
        targetUserId,
        'pending',
        source,
        deepLink,
        JSON.stringify(meta),
        actorUserId,
      ],
    );
    const row = inserted[0] as Record<string, unknown>;
    const notificationId = String(row.id);
    const resolvedDeepLink =
      deepLink ?? `vitapp://alerts?id=${encodeURIComponent(notificationId)}`;

    let push: SendNotificationResult['push'] = {
      configured: this.oneSignal.isConfigured(),
      enabled: this.oneSignal.isEnabled(),
      skipped: true,
      reason: 'push disabled for this publish',
      recipientCount: 0,
    };

    if (wantPush) {
      const { externalIds, subscriptionIds } = await this.resolveRecipients(
        targetRole,
        targetUserId,
      );
      const result = await this.oneSignal.send({
        title,
        message,
        externalIds,
        subscriptionIds,
        data: {
          notificationId,
          tenantId: this.tenantContext.getTenantId() ?? '',
          targetRole: targetRole ?? '',
          source,
          deepLink: resolvedDeepLink,
        },
      });
      push = {
        configured: result.configured,
        enabled: result.enabled,
        skipped: result.skipped,
        reason: result.reason,
        recipientCount: result.recipientCount,
        onesignalId: result.onesignalId,
        errors: result.errors,
      };
      if (result.errors?.length) {
        this.logger.warn(
          `Notification ${notificationId} push issues: ${result.errors.join('; ')}`,
        );
      }
    }

    const status = wantPush ? this.statusFromPush(push) : 'recorded';
    await this.dataSource.query(
      `UPDATE "${schema}"."notifications"
       SET status = $2,
           deep_link = COALESCE(deep_link, $3),
           updated_at = now()
       WHERE id = $1`,
      [notificationId, status, resolvedDeepLink],
    );

    return {
      notification: this.mapNotification({
        ...row,
        status,
        deep_link: row.deep_link ?? resolvedDeepLink,
        is_read: false,
      }),
      push,
    };
  }

  async send(
    input: SendNotificationInput,
    actorUserId: string | null,
  ): Promise<SendNotificationResult> {
    const result = await this.publish(
      { ...input, source: input.source ?? 'manual', push: true },
      actorUserId,
    );
    if (!result) {
      throw new BadRequestException('Duplicate notification suppressed');
    }
    return result;
  }

  private statusFromPush(push: {
    configured: boolean;
    enabled: boolean;
    skipped: boolean;
    reason?: string;
    recipientCount: number;
    onesignalId?: string | null;
    errors?: string[];
  }): string {
    if (!push.configured || !push.enabled) {
      return 'recorded';
    }
    if (push.skipped && push.recipientCount === 0) return 'sent_no_devices';
    if (this.isUnsubscribedOnly(push.errors)) return 'sent_no_devices';
    if (push.errors?.length && !push.onesignalId) return 'push_failed';
    if (push.errors?.length && push.onesignalId) return 'push_partial';
    return 'sent';
  }

  private isUnsubscribedOnly(errors?: string[]): boolean {
    if (!errors?.length) return false;
    return errors.every((e) =>
      /not subscribed|no subscribed|no.*players.*subscribed|have not opened the app/i.test(
        e,
      ),
    );
  }

  private normalizeRole(role?: string | null): string | null {
    const r = role?.trim();
    if (!r) return null;
    if (r !== 'TENANT_ADMIN' && r !== 'TENANT_USER') {
      throw new BadRequestException('targetRole must be TENANT_ADMIN or TENANT_USER');
    }
    return r;
  }

  private async assertCategoryExists(id: string) {
    const schema = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `SELECT 1 FROM "${schema}"."notification_categories" WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Category not found');
  }

  private async resolveRecipients(
    targetRole: string | null,
    targetUserId: string | null,
  ): Promise<{ externalIds: string[]; subscriptionIds: string[] }> {
    const tenantSlug = this.tenantContext.getTenantId();
    if (!tenantSlug) {
      throw new BadRequestException('Tenant context missing');
    }

    if (targetUserId) {
      const subscriptionIds = await this.subscriptionIdsForUsers(
        [targetUserId],
        tenantSlug,
        targetRole,
      );
      return { externalIds: [targetUserId], subscriptionIds };
    }

    const externalIds: string[] = [];
    if (!targetRole || targetRole === 'TENANT_USER') {
      externalIds.push(...(await this.listDriverIds()));
    }
    if (!targetRole || targetRole === 'TENANT_ADMIN') {
      externalIds.push(...(await this.listTenantAdminIds(tenantSlug)));
    }

    const unique = [...new Set(externalIds)];
    const subscriptionIds = await this.subscriptionIdsForUsers(
      unique,
      tenantSlug,
      targetRole,
    );
    return { externalIds: unique, subscriptionIds };
  }

  private async listDriverIds(): Promise<string[]> {
    const schema = this.tenantScope.getTenantSchema();
    const rows = await this.dataSource.query(
      `SELECT id FROM "${schema}"."users" WHERE is_active = true`,
    );
    return rows.map((r: { id: string }) => String(r.id));
  }

  private async listTenantAdminIds(tenantSlug: string): Promise<string[]> {
    const admins = await this.authUsers.find({
      where: {
        role: 'TENANT_ADMIN',
        tenantId: tenantSlug,
        isActive: true,
      },
      select: ['id'],
    });
    return admins.map((a) => a.id);
  }

  private async subscriptionIdsForUsers(
    userIds: string[],
    tenantSlug: string,
    targetRole: string | null,
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const qb = this.deviceBindings
      .createQueryBuilder('d')
      .select('DISTINCT d.push_token', 'push_token')
      .where('d.user_id IN (:...userIds)', { userIds })
      .andWhere('d.tenant_id = :tenantSlug', { tenantSlug })
      .andWhere('d.revoked_at IS NULL')
      .andWhere('d.push_token IS NOT NULL')
      .andWhere("d.push_token <> ''");
    if (targetRole) {
      qb.andWhere('d.user_role = :role', { role: targetRole });
    }
    const rows = await qb.getRawMany<{ push_token: string }>();
    return rows.map((r) => r.push_token).filter(Boolean);
  }

  private mapNotification(r: Record<string, unknown>): NotificationDto {
    const createdAt =
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? new Date().toISOString());
    let meta: Record<string, unknown> = {};
    if (r.meta != null) {
      if (typeof r.meta === 'string') {
        try {
          meta = JSON.parse(r.meta) as Record<string, unknown>;
        } catch {
          meta = {};
        }
      } else if (typeof r.meta === 'object') {
        meta = r.meta as Record<string, unknown>;
      }
    }
    return {
      id: String(r.id),
      title: String(r.title),
      message: String(r.message),
      categoryId: r.category_id != null ? String(r.category_id) : null,
      targetRole: r.target_role != null ? String(r.target_role) : null,
      targetUserId: r.target_user_id != null ? String(r.target_user_id) : null,
      status: String(r.status ?? 'sent'),
      source: String(r.source ?? 'manual'),
      deepLink: r.deep_link != null ? String(r.deep_link) : null,
      meta,
      read: r.is_read === true || r.is_read === 't' || r.is_read === 1,
      createdBy: r.created_by != null ? String(r.created_by) : null,
      createdAt,
    };
  }
}
