import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types';

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o actualiza un token (upsert por token).
   * Si el token ya existe con otro userId, se reasigna al usuario actual (dispositivo cambió de cuenta).
   */
  async register(user: JwtUserPayload, token: string, platform?: string) {
    const normalizedToken = token.trim();
    const existing = await this.prisma.pushToken.findUnique({
      where: { token: normalizedToken },
    });

    if (existing) {
      const updated = await this.prisma.pushToken.update({
        where: { token: normalizedToken },
        data: {
          userId: user.id,
          platform: platform ?? existing.platform,
          enabled: true,
        },
      });
      return updated;
    }

    return this.prisma.pushToken.create({
      data: {
        userId: user.id,
        token: normalizedToken,
        platform: platform ?? null,
        enabled: true,
      },
    });
  }

  /**
   * Desregistra un token marcándolo como enabled=false (soft unregister).
   */
  async unregister(user: JwtUserPayload, token: string) {
    const normalizedToken = token.trim();
    const res = await this.prisma.pushToken.updateMany({
      where: { token: normalizedToken, userId: user.id },
      data: { enabled: false },
    });
    return { disabled: res.count > 0 };
  }

  /**
   * Obtiene los tokens activos de un usuario (para envío de push).
   */
  async getActiveTokensForUser(userId: number): Promise<{ token: string }[]> {
    return this.prisma.pushToken.findMany({
      where: { userId, enabled: true },
      select: { token: true },
    });
  }

  /**
   * Marca un token como deshabilitado (para limpieza de tokens inválidos).
   */
  async disableToken(token: string): Promise<void> {
    await this.prisma.pushToken.updateMany({
      where: { token },
      data: { enabled: false },
    });
  }
}
