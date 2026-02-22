// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types';
import { NotificationsGateway } from './notifications.gateway';
import { ExpoPushService } from '../push-tokens/expo-push.service';

const PUSH_TYPES = new Set(['NEW_MESSAGE', 'NEW_CHAT', 'IMAGE_MESSAGE']);

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
    private expoPush: ExpoPushService,
  ) {}

  async create(userId: number, type: string, title: string, body?: string, data?: any) {
    const notif = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
    // 🔔 push en tiempo real (in-app / sockets)
    this.gateway.emitToUser(userId, 'notification:new', notif);
    // 🔔 push Expo (app cerrada), solo para tipos de chat
    if (this.expoPush.isEnabled() && PUSH_TYPES.has(type)) {
      this.expoPush
        .sendToUser(userId, {
          title,
          body: body ?? '',
          data: this.normalizePushData(type, data),
        })
        .catch(() => {});
    }
    return notif;
  }

  private normalizePushData(
    type: string,
    data?: Record<string, unknown> | null,
  ): { type: string; conversationId?: number; chatId?: number; messageId?: number } {
    const out: { type: string; conversationId?: number; chatId?: number; messageId?: number } = { type };
    if (!data) return out;
    const convId = data.conversationId ?? data.chatId;
    if (typeof convId === 'number') {
      out.conversationId = convId;
      out.chatId = convId;
    }
    if (typeof data.messageId === 'number') out.messageId = data.messageId;
    return out;
  }

  async list(user: JwtUserPayload) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(user: JwtUserPayload, id: number) {
    const res = await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
    if (res.count > 0) this.gateway.emitToUser(user.id, 'notification:read', { id });
    return res;
  }

  async markAllRead(user: JwtUserPayload) {
    const res = await this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    if (res.count > 0) this.gateway.emitToUser(user.id, 'notification:readAll', {});
    return res;
  }
}
