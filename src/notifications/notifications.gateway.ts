import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: '*', credentials: true }, // ajusta CORS si hace falta
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const raw =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '') ||
        (client.handshake.query?.token as string);

      if (!raw) throw new Error('No token');
      const payload = this.jwt.verify(raw); // usa tu JWT_SECRET
      const userId = payload.sub;
      // guarda info útil y únete a una “room” por usuario
      (client.data as any).userId = userId;
      client.join(`user:${userId}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  /** emitir a 1 usuario */
  emitToUser(userId: number, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
