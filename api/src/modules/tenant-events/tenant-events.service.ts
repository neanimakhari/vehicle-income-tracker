import { Injectable, Logger } from '@nestjs/common';
import { TenantEventsGateway } from './tenant-events.gateway';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class TenantEventsService {
  private readonly logger = new Logger(TenantEventsService.name);

  constructor(
    private readonly gateway: TenantEventsGateway,
    private readonly webhooks: WebhooksService,
  ) {}

  notifyBrandUpdated(input: {
    tenantId: string;
    slug: string;
    action: 'publish' | 'reset' | 'replace';
  }) {
    const publishedAt = new Date().toISOString();
    try {
      this.gateway.emitBrandUpdated({
        tenantId: input.tenantId,
        slug: input.slug,
        publishedAt,
        action: input.action,
      });
    } catch (err) {
      this.logger.warn(`socket brand.updated failed: ${String(err)}`);
    }
    void this.webhooks
      .dispatch('brand.updated', {
        tenantId: input.tenantId,
        slug: input.slug,
        publishedAt,
        action: input.action,
      })
      .catch((err) =>
        this.logger.warn(`webhook brand.updated failed: ${String(err)}`),
      );
  }
}
