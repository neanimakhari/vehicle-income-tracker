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

  emitBrandUpdated(payload: BrandUpdatedPayload) {
    const room = `tenant:${payload.slug}`;
    this.server?.to(room).emit('brand.updated', payload);
    // Also emit by uuid room if clients joined with uuid
    this.server?.to(`tenant:${payload.tenantId}`).emit('brand.updated', payload);
  }
}
