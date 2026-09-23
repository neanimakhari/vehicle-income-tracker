import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
  createdBy: string | null;
  createdAt: string;
};

export type SendNotificationInput = {
  title: string;
  message: string;
  categoryId?: string | null;
  targetRole?: string | null;
  targetUserId?: string | null;
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
  }): Promise<NotificationDto[]> {
    const schema = this.tenantScope.getTenantSchema();
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const role = opts?.actorRole ?? null;
    const userId = opts?.actorUserId ?? null;

    // Drivers only see notifications aimed at them (or all drivers / everyone).
    if (role === 'TENANT_USER' && userId) {
      const rows = await this.dataSource.query(
        `SELECT id, category_id, title, message, target_role, target_user_id,
                status, created_by, created_at
         FROM "${schema}"."notifications"
         WHERE (target_user_id IS NULL OR target_user_id = $1)
           AND (target_role IS NULL OR target_role = 'TENANT_USER')
           AND status <> 'pending'
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit],
      );
      return rows.map((r: Record<string, unknown>) => this.mapNotification(r));
    }

    const rows = await this.dataSource.query(
      `SELECT id, category_id, title, message, target_role, target_user_id,
              status, created_by, created_at
       FROM "${schema}"."notifications"
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r: Record<string, unknown>) => this.mapNotification(r));
  }

  async send(
    input: SendNotificationInput,
    actorUserId: string | null,
  ): Promise<SendNotificationResult> {
    const title = input.title?.trim();
    const message = input.message?.trim();
    if (!title || !message) {
      throw new BadRequestException('Title and message are required');
    }

    const targetRole = this.normalizeRole(input.targetRole);
    const categoryId = input.categoryId?.trim() || null;
    const targetUserId = input.targetUserId?.trim() || null;

    if (categoryId) {
      await this.assertCategoryExists(categoryId);
    }

    const schema = this.tenantScope.getTenantSchema();
    const inserted = await this.dataSource.query(
      `INSERT INTO "${schema}"."notifications"
         (category_id, title, message, target_role, target_user_id, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category_id, title, message, target_role, target_user_id,
                 status, created_by, created_at`,
      [
        categoryId,
        title,
        message,
        targetRole,
        targetUserId,
        'pending',
        actorUserId,
      ],
    );
    const row = inserted[0] as Record<string, unknown>;
    const notificationId = String(row.id);

    const { externalIds, subscriptionIds } = await this.resolveRecipients(
      targetRole,
      targetUserId,
    );

    const push = await this.oneSignal.send({
      title,
      message,
      externalIds,
      subscriptionIds,
      data: {
        notificationId,
        tenantId: this.tenantContext.getTenantId() ?? '',
        targetRole: targetRole ?? '',
      },
    });

    const status = this.statusFromPush(push);
    await this.dataSource.query(
      `UPDATE "${schema}"."notifications"
       SET status = $2, updated_at = now()
       WHERE id = $1`,
      [notificationId, status],
    );

    if (push.errors?.length) {
      this.logger.warn(
        `Notification ${notificationId} push issues: ${push.errors.join('; ')}`,
      );
    }

    return {
      notification: this.mapNotification({ ...row, status }),
      push: {
        configured: push.configured,
        enabled: push.enabled,
        skipped: push.skipped,
        reason: push.reason,
        recipientCount: push.recipientCount,
        onesignalId: push.onesignalId,
        errors: push.errors,
      },
    };
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
      return 'recorded'; // saved in DB; push not attempted (credentials pending)
    }
    if (push.skipped && push.recipientCount === 0) return 'sent_no_devices';
    // OneSignal often returns this when external_ids resolve but no device opted in yet.
    if (this.isUnsubscribedOnly(push.errors)) return 'sent_no_devices';
    if (push.errors?.length && !push.onesignalId) return 'push_failed';
    if (push.errors?.length && push.onesignalId) return 'push_partial';
    return 'sent';
  }

  private isUnsubscribedOnly(errors?: string[]): boolean {
    if (!errors?.length) return false;
    return errors.every((e) =>
      /not subscribed|no subscribed|no.*players.*subscribed/i.test(e),
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
    return {
      id: String(r.id),
      title: String(r.title),
      message: String(r.message),
      categoryId: r.category_id != null ? String(r.category_id) : null,
      targetRole: r.target_role != null ? String(r.target_role) : null,
      targetUserId: r.target_user_id != null ? String(r.target_user_id) : null,
      status: String(r.status ?? 'sent'),
      createdBy: r.created_by != null ? String(r.created_by) : null,
      createdAt,
    };
  }
}
