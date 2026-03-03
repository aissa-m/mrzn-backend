import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MoosylApiService } from './moosyl-api.service';
import * as crypto from 'crypto';

@Injectable()
export class MoosylService {
  private readonly logger = new Logger(MoosylService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly moosylApi: MoosylApiService,
  ) { }

  private getWebhookSecret(): string {
    const secret = this.config.get<string>('MOOSYL_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('MOOSYL_WEBHOOK_SECRET no está configurada');
    }
    return secret;
  }

  /**
   * Obtiene o crea la cartera del usuario.
   */
  async getOrCreateWallet(userId: number) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, currency: 'MRU' },
      });
    }
    return wallet;
  }

  /**
   * Crea un PaymentIntent y solicitud de pago en Moosyl. Devuelve transactionId para el móvil.
   */
  async createWalletTopup(userId: number, amount: number) {
    const wallet = await this.getOrCreateWallet(userId);
    const transactionId = `topup_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const paymentIntent = await this.prisma.paymentIntent.create({
      data: {
        userId,
        walletId: wallet.id,
        provider: 'MOOSYL',
        purpose: 'WALLET_TOPUP',
        amount: new Prisma.Decimal(amount),
        status: 'CREATED',
        transactionId,
      },
    });

    try {
      await this.moosylApi.createPaymentRequest(amount, transactionId);
    } catch (err) {
      this.logger.warn(`Moosyl createPaymentRequest failed: ${err}`);
      await this.prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(
        'No se pudo crear la solicitud de pago. Inténtalo más tarde.',
      );
    }

    await this.prisma.paymentIntent.update({
      where: { id: paymentIntent.id },
      data: { status: 'PENDING' },
    });

    return {
      transactionId,
      amount,
      currency: 'MRU',
    };
  }

  /**
   * Verifica la firma HMAC-SHA256 del webhook Moosyl.
   * Signature must be "sha256=<hex>". HMAC is computed over the exact raw request bytes (Buffer).
   * Doc: https://docs.moosyl.com/webhooks
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {

    console.log("RAW BODY LENGTH:", rawBody.length);
    console.log("RAW BODY STRING:");
    console.log(JSON.stringify(rawBody.toString("utf8")));
    

    if (!signature || typeof signature !== 'string' || !signature.startsWith('sha256=')) {
      return false;
    }
    const receivedHex = signature.slice(7).trim();
    if (!/^[a-fA-F0-9]+$/.test(receivedHex) || receivedHex.length % 2 !== 0) {
      return false;
    }
    const expectedSignature = crypto
      .createHmac('sha256', this.getWebhookSecret())
      .update(rawBody)
      .digest('hex');

    try {
      const receivedBuf = Buffer.from(receivedHex, 'hex');
      const expectedBuf = Buffer.from(expectedSignature, 'hex');
      if (receivedBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(receivedBuf, expectedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Procesa el webhook de Moosyl. Idempotente por provider + idempotencyKey (event id o derivado).
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    eventType: string | undefined,
  ): Promise<void> {
    if (!signature || !signature.startsWith('sha256=')) {
      throw new BadRequestException('Missing or invalid webhook signature (expected sha256=<hex>)');
    }
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const rawBodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    let payload: {
      event?: string;
      data?: { id?: string; amount?: number; transactionId?: string; status?: string };
      event_id?: string;
      transactionId?: string;
    };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const event = eventType ?? payload.event;
    const data = payload.data ?? {};
    const transactionId =
      data.transactionId ?? data.id ?? payload.transactionId;
    const status = (data.status ?? '').toLowerCase();
    const amount = data.amount;

    const providerEventId =
      data.id ?? payload.event_id ?? (payload as { id?: string }).id;
    const idempotencyKey =
      providerEventId ??
      `MOOSYL|${transactionId ?? 'unknown'}|${event ?? 'unknown'}|${status}|${amount ?? ''}`;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_idempotencyKey: { provider: 'MOOSYL', idempotencyKey },
      },
    });
    if (existing) {
      this.logger.log(
        `Webhook idempotent skip: provider=MOOSYL idempotencyKey=${idempotencyKey.slice(0, 48)}...`,
      );
      return;
    }

    await this.prisma.webhookEvent.create({
      data: {
        provider: 'MOOSYL',
        idempotencyKey,
        eventType: event ?? 'unknown',
        transactionId: transactionId ?? null,
        signature: signature ?? null,
        rawBodyHash,
      },
    });

    const isSuccessStatus = ['completed', 'success', 'paid'].includes(status);
    const isPaymentEvent =
      event === 'payment-created' ||
      event === 'payment.completed' ||
      event === 'payment_completed';

    if (isPaymentEvent && isSuccessStatus) {
      await this.creditWalletFromPayment(transactionId, amount);
    } else {
      this.logger.log(
        `Webhook event ignored: event=${event}, status=${data.status ?? 'N/A'}`,
      );
    }
  }

  /**
   * Acredita la cartera y actualiza el PaymentIntent. Atomic: only one credit per intent.
   */
  private async creditWalletFromPayment(
    transactionId: string | undefined,
    amount: number | undefined,
  ): Promise<void> {
    if (!transactionId) {
      this.logger.warn('payment event without transactionId, skipping credit');
      return;
    }

    const intent = await this.prisma.paymentIntent.findUnique({
      where: { transactionId },
      include: { wallet: true },
    });

    if (!intent) {
      this.logger.warn(`PaymentIntent not found for transactionId=${transactionId}`);
      return;
    }

    const creditAmount = amount ?? Number(intent.amount);
    if (creditAmount <= 0) {
      this.logger.warn(`Invalid amount ${creditAmount} for ${transactionId}`);
      return;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.paymentIntent.updateMany({
        where: {
          id: intent.id,
          status: { not: 'PAID' },
        },
        data: { status: 'PAID' },
      });
      if (updateResult.count === 0) {
        this.logger.log(`PaymentIntent ${transactionId} already PAID, skipping credit`);
        return null;
      }
      await tx.walletLedger.create({
        data: {
          walletId: intent.walletId,
          type: 'TOPUP',
          amount: new Prisma.Decimal(creditAmount),
          reference: `Moosyl ${transactionId}`,
        },
      });
      return { userId: intent.userId, creditAmount, transactionId };
    });

    if (updated) {
      this.logger.log(
        `Wallet credited: userId=${updated.userId}, amount=${updated.creditAmount}, txn=${updated.transactionId}`,
      );
    }
  }
}
