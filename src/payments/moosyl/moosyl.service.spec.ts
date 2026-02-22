import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MoosylApiService } from './moosyl-api.service';
import { MoosylService } from './moosyl.service';
import * as crypto from 'crypto';

describe('MoosylService', () => {
  let service: MoosylService;
  let prisma: jest.Mocked<Pick<PrismaService, 'webhookEvent' | 'paymentIntent' | 'wallet' | 'walletLedger'>>;
  let config: jest.Mocked<Pick<ConfigService, 'get'>>;
  const webhookSecret = 'test-webhook-secret';

  beforeEach(async () => {
    const mockPrisma = {
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      paymentIntent: { findUnique: jest.fn(), updateMany: jest.fn() },
      walletLedger: { create: jest.fn() },
      wallet: { findUnique: jest.fn(), create: jest.fn() },
    };
    const mockConfig = {
      get: jest.fn((key: string) => (key === 'MOOSYL_WEBHOOK_SECRET' ? webhookSecret : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoosylService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MoosylApiService, useValue: {} },
      ],
    }).compile();

    service = module.get(MoosylService);
    prisma = module.get(PrismaService) as typeof mockPrisma;
    config = module.get(ConfigService) as typeof mockConfig;
    jest.clearAllMocks();
  });

  describe('verifyWebhookSignature', () => {
    it('returns false when signature is missing', () => {
      const raw = Buffer.from('{"event":"payment-created"}');
      expect(service.verifyWebhookSignature(raw, undefined)).toBe(false);
      expect(service.verifyWebhookSignature(raw, '')).toBe(false);
    });

    it('returns false when signature format is not sha256=<hex>', () => {
      const raw = Buffer.from('{"event":"payment-created"}');
      expect(service.verifyWebhookSignature(raw, 'invalid')).toBe(false);
      expect(service.verifyWebhookSignature(raw, 'sha256')).toBe(false);
      expect(service.verifyWebhookSignature(raw, 'sha256=nothex!')).toBe(false);
    });

    it('returns true when signature matches HMAC of raw body (Buffer)', () => {
      const raw = Buffer.from('{"event":"payment-created","data":{"status":"completed"}}');
      const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
      expect(service.verifyWebhookSignature(raw, `sha256=${expected}`)).toBe(true);
    });

    it('returns false when signature does not match', () => {
      const raw = Buffer.from('{"event":"payment-created"}');
      const wrong = crypto.createHmac('sha256', 'wrong-secret').update(raw).digest('hex');
      expect(service.verifyWebhookSignature(raw, `sha256=${wrong}`)).toBe(false);
    });
  });

  describe('handleWebhook', () => {
    it('throws BadRequestException when signature is missing', async () => {
      const raw = Buffer.from(JSON.stringify({ event: 'payment-created' }));
      await expect(service.handleWebhook(raw, undefined, undefined)).rejects.toThrow(BadRequestException);
      await expect(service.handleWebhook(raw, '', undefined)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when signature is invalid', async () => {
      const raw = Buffer.from(JSON.stringify({ event: 'payment-created' }));
      await expect(service.handleWebhook(raw, 'sha256=deadbeef', undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('skips processing when idempotency key already exists', async () => {
      const payload = { event: 'payment-created', data: { status: 'completed', transactionId: 'tx-1' } };
      const raw = Buffer.from(JSON.stringify(payload));
      const sig = `sha256=${crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex')}`;

      prisma.webhookEvent.findUnique.mockResolvedValue({
        id: 1,
        provider: 'MOOSYL',
        idempotencyKey: 'tx-1',
        eventType: 'payment-created',
        transactionId: 'tx-1',
        signature: null,
        rawBodyHash: null,
        receivedAt: new Date(),
      } as any);

      await service.handleWebhook(raw, sig, undefined);

      expect(prisma.webhookEvent.findUnique).toHaveBeenCalled();
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    });
  });
});
