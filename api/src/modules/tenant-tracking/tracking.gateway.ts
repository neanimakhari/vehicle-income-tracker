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
import { CommercialService } from '../commercial/commercial.service';

@WebSocketGateway({
  namespace: '/tracking',
  cors: { origin: true, credentials: true },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly commercial: CommercialService,
  ) {}

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
      const allowed = await this.commercial.hasModule(tenantId, 'tracking_live');
      if (!allowed) {
        client.disconnect(true);
        return;
      }
      await client.join(`tenant:${tenantId}`);
      (client.data as { tenantId?: string }).tenantId = tenantId;
    } catch (err) {
      this.logger.debug(`tracking ws reject: ${String(err)}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // no-op
  }

  @SubscribeMessage('tracking:subscribe')
  async onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { tenantId?: string },
  ) {
    const tenantId =
      body?.tenantId ?? (client.data as { tenantId?: string }).tenantId;
    if (!tenantId) return;
    await client.join(`tenant:${tenantId}`);
  }

  emitPoint(tenantSlug: string, point: Record<string, unknown>) {
    this.server?.to(`tenant:${tenantSlug}`).emit('tracking:update', point);
  }
}
