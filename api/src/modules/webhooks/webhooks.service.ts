import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHmac } from 'node:crypto';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';
import { WebhookSubscription } from './webhook-subscription.entity';

const WEBHOOK_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
  ) {}

  async list(): Promise<WebhookSubscription[]> {
    const repo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      WebhookSubscription,
    );
    return repo.withSchema(r => r.find({ order: { createdAt: 'DESC' } }));
  }

  async register(url: string, secret: string, eventTypes: string[]): Promise<WebhookSubscription> {
    const repo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      WebhookSubscription,
    );
    return repo.withSchema(async r => {
      const sub = r.create({ url, secret, eventTypes, active: true });
      return r.save(sub);
    });
  }

  async unregister(id: string): Promise<void> {
    const repo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      WebhookSubscription,
    );
    await repo.withSchema(async r => {
      const existing = await r.findOne({ where: { id } });
      if (!existing) throw new NotFoundException('Webhook subscription not found');
      await r.remove(existing);
    });
  }

  /** Dispatches event to all active subscriptions that include this event type. Does not throw. */
  async dispatch(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const repo = new TenantAwareRepository(
      this.dataSource,
      this.tenantScope,
      WebhookSubscription,
    );
    let subs: WebhookSubscription[] = [];
    try {
      subs = await repo.withSchema(r =>
        r.find({ where: { active: true }, select: ['id', 'url', 'secret', 'eventTypes'] }),
      );
    } catch {
      return;
    }
    const matching = subs.filter(
      s => Array.isArray(s.eventTypes) && s.eventTypes.includes(eventType),
    );
    const body = JSON.stringify({ event: eventType, payload, timestamp: new Date().toISOString() });
    await Promise.allSettled(
      matching.map(sub => this.sendOne(sub.url, sub.secret, body)),
    );
  }

  private async sendOne(url: string, secret: string, body: string): Promise<void> {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      // Fire-and-forget; caller does not need to know
    } finally {
      clearTimeout(timeout);
    }
  }
}

