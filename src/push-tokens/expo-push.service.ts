import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushTokensService } from './push-tokens.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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
      this.logger.log('Expo push is disabled (EXPO_PUSH_ENABLED != true)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Envía push a todos los tokens activos del usuario.
   * Marca como deshabilitados los tokens que Expo devuelve como inválidos.
   */
  async sendToUser(
    userId: number,
    payload: ExpoPushPayload,
  ): Promise<{ sent: number; invalid: number }> {
    if (!this.enabled) return { sent: 0, invalid: 0 };

    const rows = await this.pushTokens.getActiveTokensForUser(userId);
    if (rows.length === 0) return { sent: 0, invalid: 0 };

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
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      const json = (await res.json()) as ExpoSendResponse;

      if (!res.ok) {
        this.logger.warn(
          `Expo push request failed: ${res.status} ${JSON.stringify(json.errors ?? json)}`,
        );
        return { sent: 0, invalid: 0 };
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
              this.logger.debug(`Disabled invalid push token for user ${userId}`);
            }
          }
        }
      }

      const sent = Math.max(0, messages.length - invalid);
      if (sent > 0 || invalid > 0) {
        this.logger.debug(
          `Expo push userId=${userId} sent=${sent} invalid=${invalid}`,
        );
      }
      return { sent, invalid };
    } catch (err) {
      this.logger.warn(
        `Expo push send failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { sent: 0, invalid: 0 };
    }
  }

  private buildData(payload: ExpoPushPayload): Record<string, unknown> {
    const data: Record<string, unknown> = { ...payload.data };
    if (payload.data?.type) data.type = payload.data.type;
    const convId =
      payload.data?.conversationId ?? payload.data?.chatId;
    if (convId != null) {
      data.conversationId = convId;
      data.chatId = convId;
    }
    if (payload.data?.messageId != null) data.messageId = payload.data.messageId;
    return data;
  }

  private isInvalidTokenError(ticket: ExpoTicket): boolean {
    const err = ticket.details?.error;
    return err === 'DeviceNotRegistered' || err === 'InvalidCredentials';
  }
}
