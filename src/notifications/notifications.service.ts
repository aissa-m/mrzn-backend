import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  async create(userId: number, type: string, title: string, body?: string, data?: any) {
    const notif = await this.prisma.notification.create({
      data: { userId, type, title, body, data },
    });
    // 🔔 push en tiempo real
    this.gateway.emitToUser(userId, 'notification:new', notif);
    return notif;
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
