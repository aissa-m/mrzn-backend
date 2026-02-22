import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MOOSYL_API_BASE = 'https://api.moosyl.com';

export interface MoosylPaymentRequestResponse {
  transactionId: string;
  [key: string]: unknown;
}

@Injectable()
export class MoosylApiService {
  constructor(private readonly config: ConfigService) {}

  private getSecretKey(): string {
    const key = this.config.get<string>('MOOSYL_SECRET_KEY');
    if (!key) {
      throw new Error('MOOSYL_SECRET_KEY no está configurada');
    }
    return key;
  }

  /**
   * Crea una solicitud de pago en Moosyl.
   * Doc: https://docs.moosyl.com/ - POST /payment-request
   */
  async createPaymentRequest(
    amount: number,
    transactionId: string,
    phoneNumber?: string,
  ): Promise<MoosylPaymentRequestResponse> {
    const body: Record<string, unknown> = {
      amount,
      transactionId,
    };
    if (phoneNumber) {
      body.phoneNumber = phoneNumber;
    }

    const res = await fetch(`${MOOSYL_API_BASE}/payment-request`, {
      method: 'POST',
      headers: {
        Authorization: this.getSecretKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Moosyl API error ${res.status}: ${errText || res.statusText}`,
      );
    }

    const data = (await res.json()) as MoosylPaymentRequestResponse;
    return data;
  }
}
