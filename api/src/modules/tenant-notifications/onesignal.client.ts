import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OneSignalSendInput = {
  title: string;
  message: string;
  /** User UUIDs previously registered via OneSignal.login(external_id). */
  externalIds: string[];
  /** Optional OneSignal subscription / player IDs from device_bindings.push_token. */
  subscriptionIds?: string[];
  data?: Record<string, string>;
};

export type OneSignalSendResult = {
  configured: boolean;
  enabled: boolean;
  skipped: boolean;
  reason?: string;
  recipientCount: number;
  onesignalId?: string | null;
  errors?: string[];
  raw?: unknown;
};

/**
 * Thin REST client for OneSignal create-notification.
 * Safe when credentials are missing: returns skipped without throwing.
 */
@Injectable()
export class OneSignalClient {
  private readonly logger = new Logger(OneSignalClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const appId = this.appId();
    const key = this.restApiKey();
    return Boolean(appId && key);
  }

  isEnabled(): boolean {
    return (
      this.config.get<boolean>('onesignal.enabled') === true ||
      process.env.ONESIGNAL_ENABLED === 'true'
    );
  }

  async send(input: OneSignalSendInput): Promise<OneSignalSendResult> {
    const externalIds = [...new Set(input.externalIds.filter(Boolean))];
    const subscriptionIds = [
      ...new Set((input.subscriptionIds ?? []).filter(Boolean)),
    ];
    const recipientCount = externalIds.length + subscriptionIds.length;

    if (!this.isConfigured()) {
      return {
        configured: false,
        enabled: this.isEnabled(),
        skipped: true,
        reason: 'ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY not set',
        recipientCount,
      };
    }
    if (!this.isEnabled()) {
      return {
        configured: true,
        enabled: false,
        skipped: true,
        reason: 'ONESIGNAL_ENABLED is not true',
        recipientCount,
      };
    }
    if (recipientCount === 0) {
      return {
        configured: true,
        enabled: true,
        skipped: true,
        reason: 'No recipients with push identity',
        recipientCount: 0,
      };
    }

    const body: Record<string, unknown> = {
      app_id: this.appId(),
      target_channel: 'push',
      headings: { en: input.title },
      contents: { en: input.message },
      data: input.data ?? {},
    };

    // Prefer alias targeting; fall back to subscription ids when present alone.
    if (externalIds.length > 0) {
      body.include_aliases = { external_id: externalIds };
    }
    if (subscriptionIds.length > 0 && externalIds.length === 0) {
      body.include_subscription_ids = subscriptionIds;
    }

    try {
      const res = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.restApiKey()}`,
        },
        body: JSON.stringify(body),
      });
      const raw = (await res.json().catch(() => ({}))) as {
        id?: string;
        errors?: unknown;
        message?: string;
      };
      if (!res.ok) {
        const errMsg =
          typeof raw.message === 'string'
            ? raw.message
            : `OneSignal HTTP ${res.status}`;
        this.logger.warn(`OneSignal send failed: ${errMsg}`);
        return {
          configured: true,
          enabled: true,
          skipped: false,
          recipientCount,
          onesignalId: raw.id ?? null,
          errors: [errMsg, ...(this.flattenErrors(raw.errors))],
          raw,
        };
      }
      return {
        configured: true,
        enabled: true,
        skipped: false,
        recipientCount,
        onesignalId: raw.id ?? null,
        errors: this.flattenErrors(raw.errors),
        raw,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'OneSignal request failed';
      this.logger.warn(msg);
      return {
        configured: true,
        enabled: true,
        skipped: false,
        recipientCount,
        errors: [msg],
      };
    }
  }

  private appId(): string {
    return (
      this.config.get<string>('onesignal.appId') ??
      process.env.ONESIGNAL_APP_ID ??
      ''
    ).trim();
  }

  private restApiKey(): string {
    return (
      this.config.get<string>('onesignal.restApiKey') ??
      process.env.ONESIGNAL_REST_API_KEY ??
      ''
    ).trim();
  }

  private flattenErrors(errors: unknown): string[] {
    if (!errors) return [];
    if (Array.isArray(errors)) return errors.map(String);
    if (typeof errors === 'object') return [JSON.stringify(errors)];
    return [String(errors)];
  }
}
