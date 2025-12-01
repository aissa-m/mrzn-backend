// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  userId: number;
  userEmail?: string;
  userRole?: string;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: process.env.CHAT_WS_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? ['http://localhost:3000'],
  },
})
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Tracking de usuarios online: userId -> Set<socketId>
  private onlineUsers = new Map<number, Set<string>>();

  // Tracking de typing: conversationId -> Set<userId>
  private typingUsers = new Map<number, Set<number>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraer userId del token (WsJwtGuard lo setea)
      const userId = client.userId;

      if (!userId) {
        throw new Error('Missing user in socket context');
      }

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(client.id);

      // Unirse a rooms de sus conversaciones
      const conversations = await this.prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });

      conversations.forEach((c) => {
        client.join(`conversation:${c.conversationId}`);
      });

      // Emitir presencia a contactos
      this.broadcastPresence(userId, 'online');

      console.log(`Chat: User ${userId} connected (${client.id})`);
    } catch (error) {
      console.error('Chat connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;

    const userSockets = this.onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);

      // Si no quedan sockets, marcar offline
      if (userSockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.broadcastPresence(userId, 'offline');
      }
    }

    // Limpiar typing por conversación en caso de desconexión
    this.typingUsers.forEach((users, conversationId) => {
      if (users.delete(userId)) {
        client
          .to(`conversation:${conversationId}`)
          .emit('typing:stop', { conversationId, userId });
      }
      if (users.size === 0) {
        this.typingUsers.delete(conversationId);
      }
    });

    console.log(`Chat: User ${userId} disconnected (${client.id})`);
  }

  /** Emitir nuevo mensaje a participantes */
  emitNewMessage(conversationId: number, message: any) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:new', { conversationId, message });
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: number; content: string },
  ) {
    const userId = client.userId;
    const { conversationId, content } = data;

    if (!userId) {
      throw new Error('Unauthenticated socket');
    }

    if (!conversationId || !content?.trim()) {
      throw new Error('conversationId y content son requeridos');
    }

    // Reutilizamos la lógica del servicio (valida pertenencia, notifica y emite WS)
    const message = await this.chatService.sendText(
      {
        id: userId,
        email: client.userEmail ?? '',
        role: client.userRole as any,
      },
      { conversationId, content: content.trim() },
    );

    return message;
  }

  /** Emitir lectura de mensajes */
  emitMessageRead(conversationId: number, userId: number, lastReadAt: Date) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('message:read', { conversationId, userId, lastReadAt });
  }

  /** Typing indicators */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    const { conversationId } = data;
    const userId = client.userId;

    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }
    this.typingUsers.get(conversationId)!.add(userId);

    // Emitir a otros participantes
    client.to(`conversation:${conversationId}`).emit('typing:start', {
      conversationId,
      userId,
    });

    // Auto-stop después de 5s
    setTimeout(() => {
      this.handleTypingStop(client, data);
    }, 5000);
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    const { conversationId } = data;
    const userId = client.userId;

    this.typingUsers.get(conversationId)?.delete(userId);

    client.to(`conversation:${conversationId}`).emit('typing:stop', {
      conversationId,
      userId,
    });
  }

  /** Presencia a contactos */
  private async broadcastPresence(
    userId: number,
    status: 'online' | 'offline',
  ) {
    // Obtener conversaciones del usuario
    const conversations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    conversations.forEach((c) => {
      this.server
        .to(`conversation:${c.conversationId}`)
        .emit('presence:change', { userId, status });
    });
  }

  /** Verificar si usuario está online */
  isUserOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }

  /** Obtener usuarios online en conversación */
  getOnlineInConversation(conversationId: number): number[] {
    // Implementar lógica de tracking por conversación si es necesario
    return [];
  }
}
