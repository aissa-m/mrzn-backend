import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUserPayload } from '../auth/types';

@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra o actualiza un token (upsert por token).
   * Si el token ya existe con otro userId, se reasigna al usuario actual (dispositivo cambió de cuenta).
   * Verifica que el usuario exista antes de crear (evita P2003 tras migrate reset).
   */
  async register(user: JwtUserPayload, token: string, platform?: string) {
    const normalizedToken = token.trim();

    const userExists = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!userExists) {
      this.logger.warn(
        `[PUSH] Attempt to register token for non-existing userId=${user.id}`,
      );
      throw new BadRequestException(
        'User not found. After a database reset, please log in again.',
      );
    }

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

  /**
   * Marca varios tokens como deshabilitados (p. ej. tras PUSH_TOO_MANY_EXPERIENCE_IDS).
   */
  async disableTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.pushToken.updateMany({
      where: { token: { in: tokens } },
      data: { enabled: false },
    });
  }

  /**
   * Dev only: devuelve cantidad, sufijos y estado enabled de los tokens del usuario.
   */
  async getTokensForUserDebug(
    userId: number,
  ): Promise<{ count: number; tokens: { suffix: string; enabled: boolean }[] }> {
    const rows = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true, enabled: true },
    });
    const tokens = rows.map((r) => ({
      suffix: r.token.length >= 6 ? `...${r.token.slice(-6)}` : r.token,
      enabled: r.enabled,
    }));
    return { count: rows.length, tokens };
  }
}
