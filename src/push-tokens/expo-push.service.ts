/**
 * IMPORTANT:
 * - Requires EXPO_PUSH_ENABLED=true for sending.
 * - After prisma migrate reset, all clients must re-login (tokens may reference stale user ids).
 * - Push tokens are project-specific (EAS projectId / experienceId); mixing tokens from
 *   different projects in one request returns PUSH_TOO_MANY_EXPERIENCE_IDS.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushTokensService } from './push-tokens.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TOO_MANY_EXPERIENCE_IDS = 'PUSH_TOO_MANY_EXPERIENCE_IDS';

export interface ExpoPushPayload {
  title: string;
  body?: string;
  data?: {
    type?: string;
    conversationId?: number;
    chatId?: number;
    messageId?: number;
    [key: string]: unknown;
  };
}

interface ExpoMessage {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoSendResponse {
  data?: ExpoTicket[];
  errors?: { code: string; message: string }[];
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly pushTokens: PushTokensService,
  ) {
    this.enabled =
      this.config.get<string>('EXPO_PUSH_ENABLED', 'false').toLowerCase() ===
      'true';

    if (!this.enabled) {
      this.logger.log('[PUSH] Expo push disabled (EXPO_PUSH_ENABLED != true)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendToUser(
    userId: number,
    payload: ExpoPushPayload,
  ): Promise<{ sent: number; invalid: number }> {
    if (!this.enabled) {
      this.logger.log('[PUSH] Disabled by EXPO_PUSH_ENABLED flag');
      return { sent: 0, invalid: 0 };
    }

    const rows = await this.pushTokens.getActiveTokensForUser(userId);

    if (rows.length === 0) {
      this.logger.log(`[PUSH] No active tokens for userId=${userId}`);
      return { sent: 0, invalid: 0 };
    }

    const tokenSuffixes = rows.map((r) =>
      r.token.length >= 6 ? `...${r.token.slice(-6)}` : r.token,
    );
    this.logger.log(
      `[PUSH] Sending userId=${userId} tokensCount=${rows.length} tokenSuffixes=[${tokenSuffixes.join(', ')}]`,
    );

    const messages: ExpoMessage[] = rows.map((r) => ({
      to: r.token,
      title: payload.title,
      body: payload.body ?? '',
      data: this.buildData(payload),
      sound: 'default',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const json = (await res.json()) as ExpoSendResponse;

      if (!res.ok) {
        const hasMixedProjects = Array.isArray(json.errors) &&
          json.errors.some(
            (e: { code?: string }) => e.code === PUSH_TOO_MANY_EXPERIENCE_IDS,
          );
        if (hasMixedProjects) {
          this.logger.warn(
            '[PUSH] Mixed Expo project tokens detected (PUSH_TOO_MANY_EXPERIENCE_IDS). Disabling all tokens for this user so they can re-register from the correct app.',
          );
          await this.pushTokens.disableTokens(rows.map((r) => r.token));
        }
        this.logger.warn(
          `Expo push request failed: ${res.status} ${JSON.stringify(
            json.errors ?? json,
          )}`,
        );
        return { sent: 0, invalid: 0 };
      }

      if (Array.isArray(json.data)) {
        const mixedInTickets = json.data.some(
          (t) => t.details?.error === PUSH_TOO_MANY_EXPERIENCE_IDS,
        );
        if (mixedInTickets) {
          this.logger.warn(
            '[PUSH] Mixed Expo project tokens detected (in ticket details). Disabling all tokens for this user.',
          );
          await this.pushTokens.disableTokens(rows.map((r) => r.token));
        }
      }

      let invalid = 0;

      if (Array.isArray(json.data)) {
        for (let i = 0; i < json.data.length; i++) {
          const ticket = json.data[i];

          if (ticket.status === 'error') {
            invalid++;
            const token = messages[i]?.to;

            if (token && this.isInvalidTokenError(ticket)) {
              await this.pushTokens.disableToken(token);
              this.logger.debug(
                `Disabled invalid push token for user ${userId}`,
              );
            }
          }
        }
      }

      const sent = Math.max(0, messages.length - invalid);

      this.logger.log(
        `[PUSH] Finished userId=${userId} sent=${sent} invalid=${invalid}`,
      );

      return { sent, invalid };
    } catch (err) {
      this.logger.warn(
        `Expo push send failed for user ${userId}: ${err instanceof Error ? err.message : String(err)
        }`,
      );

      return { sent: 0, invalid: 0 };
    }
  }

  private buildData(
    payload: ExpoPushPayload,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      ...(payload.data ?? {}),
    };

    if (payload.data?.type) data.type = payload.data.type;

    const convId =
      payload.data?.conversationId ?? payload.data?.chatId;

    if (convId != null) {
      data.conversationId = convId;
      data.chatId = convId;
    }

    if (payload.data?.messageId != null) {
      data.messageId = payload.data.messageId;
    }

    return data;
  }

  private isInvalidTokenError(ticket: ExpoTicket): boolean {
    const err = ticket.details?.error;
    return (
      err === 'DeviceNotRegistered' ||
      err === 'InvalidCredentials'
    );
  }

  /**
   * Dev only: debug info for a user's push tokens (count, suffix, enabled).
   */
  async debugUserTokens(
    userId: number,
  ): Promise<{ count: number; tokens: { suffix: string; enabled: boolean }[] }> {
    return this.pushTokens.getTokensForUserDebug(userId);
  }
}