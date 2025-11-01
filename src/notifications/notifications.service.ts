// /notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Crear una notificación (para usar desde otros módulos) */
  async create(userId: number, type: string, title: string, body?: string, data?: any) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data,
      },
    });
  }

  /** Listar notificaciones del usuario */
  async list(user: JwtUserPayload) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Marcar una notificación como leída */
  async markRead(user: JwtUserPayload, id: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
  }

  /** Marcar todas como leídas */
  async markAllRead(user: JwtUserPayload) {
    return this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  }
}
