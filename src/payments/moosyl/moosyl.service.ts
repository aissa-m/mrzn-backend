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
  ) {}

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
    let wallet = await (this.prisma as any).wallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      wallet = await (this.prisma as any).wallet.create({
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

    const paymentIntent = await (this.prisma as any).paymentIntent.create({
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
      await (this.prisma as any).paymentIntent.update({
        where: { id: paymentIntent.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(
        'No se pudo crear la solicitud de pago. Inténtalo más tarde.',
      );
    }

    await (this.prisma as any).paymentIntent.update({
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
   * Doc: https://docs.moosyl.com/webhooks
   */
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string | undefined,
  ): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }
    const receivedHex = signature.slice(7);
    const payload =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expectedSignature = crypto
      .createHmac('sha256', this.getWebhookSecret())
      .update(payload, 'utf8')
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(receivedHex, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Procesa el webhook de Moosyl. Idempotente mediante WebhookEvent.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    eventType: string | undefined,
  ): Promise<void> {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const rawBodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    let payload: { event?: string; data?: { id?: string; amount?: number; transactionId?: string; status?: string } };
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const event = eventType ?? payload.event;
    const data = payload.data ?? {};
    const transactionId =
      data.transactionId ?? data.id ?? (payload as unknown as { transactionId?: string }).transactionId;

    const existing = await (this.prisma as any).webhookEvent.findUnique({
      where: { rawBodyHash },
    });
    if (existing) {
      this.logger.log(`Webhook idempotent skip: rawBodyHash=${rawBodyHash.slice(0, 16)}...`);
      return;
    }

    await (this.prisma as any).webhookEvent.create({
      data: {
        eventType: event ?? 'unknown',
        transactionId: transactionId ?? null,
        signature: signature ?? null,
        rawBodyHash,
      },
    });

    if (event === 'payment-created' && data.status === 'completed') {
      await this.creditWalletFromPayment(transactionId, data.amount);
    } else {
      this.logger.log(
        `Webhook event ignored: ${event}, status=${data.status ?? 'N/A'}`,
      );
    }
  }

  /**
   * Acredita la cartera y actualiza el PaymentIntent.
   */
  private async creditWalletFromPayment(
    transactionId: string | undefined,
    amount: number | undefined,
  ): Promise<void> {
    if (!transactionId) {
      this.logger.warn('payment-created without transactionId, skipping credit');
      return;
    }

    const intent = await (this.prisma as any).paymentIntent.findUnique({
      where: { transactionId },
      include: { wallet: true },
    });

    if (!intent) {
      this.logger.warn(`PaymentIntent not found for transactionId=${transactionId}`);
      return;
    }

    if (intent.status === 'PAID') {
      this.logger.log(`PaymentIntent ${transactionId} already PAID, skipping`);
      return;
    }

    const creditAmount = amount ?? Number(intent.amount);
    if (creditAmount <= 0) {
      this.logger.warn(`Invalid amount ${creditAmount} for ${transactionId}`);
      return;
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'PAID' },
      });
      await tx.walletLedger.create({
        data: {
          walletId: intent.walletId,
          type: 'TOPUP',
          amount: new Prisma.Decimal(creditAmount),
          reference: `Moosyl ${transactionId}`,
        },
      });
    });

    this.logger.log(
      `Wallet credited: userId=${intent.userId}, amount=${creditAmount}, txn=${transactionId}`,
    );
  }
}
