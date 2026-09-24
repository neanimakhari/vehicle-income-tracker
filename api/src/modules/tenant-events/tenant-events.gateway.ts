import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

type BrandUpdatedPayload = {
  tenantId: string;
  slug: string;
  publishedAt: string;
  action: string;
};

export type NotificationCreatedPayload = {
  id: string;
  title: string;
  message: string;
  source: string;
  deepLink: string | null;
  targetRole: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type IncidentCreatedPayload = {
  id: string;
  driverId: string;
  vehicle: string | null;
  note: string | null;
  status: string;
  createdAt: string;
  title?: string;
  message?: string;
};

@WebSocketGateway({
  namespace: '/tenant-events',
  cors: { origin: true, credentials: true },
})
export class TenantEventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TenantEventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') as
          | string
          | undefined);
      const tenantId =
        (client.handshake.auth?.tenantId as string | undefined) ??
        (client.handshake.query?.tenantId as string | undefined);
      if (!token || !tenantId) {
        client.disconnect(true);
        return;
      }
      await this.jwt.verifyAsync(token);
      const room = `tenant:${tenantId}`;
      await client.join(room);
      (client.data as { tenantId?: string }).tenantId = tenantId;
    } catch (err) {
      this.logger.debug(`tenant-events reject: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // no-op
  }

  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tenantId?: string },
  ) {
    const tenantId =
      body?.tenantId ?? (client.data as { tenantId?: string }).tenantId;
    if (!tenantId) return;
    await client.join(`tenant:${tenantId}`);
  }

  private emitToTenant(
    tenantKey: string,
    event: string,
    payload: unknown,
  ) {
    this.server?.to(`tenant:${tenantKey}`).emit(event, payload);
  }

  emitBrandUpdated(payload: BrandUpdatedPayload) {
    this.emitToTenant(payload.slug, 'brand.updated', payload);
    this.emitToTenant(payload.tenantId, 'brand.updated', payload);
  }

  emitNotificationCreated(
    tenantKey: string,
    payload: NotificationCreatedPayload,
  ) {
    this.emitToTenant(tenantKey, 'notification.created', payload);
  }

  emitIncidentCreated(tenantKey: string, payload: IncidentCreatedPayload) {
    this.emitToTenant(tenantKey, 'incident.created', payload);
  }
}
