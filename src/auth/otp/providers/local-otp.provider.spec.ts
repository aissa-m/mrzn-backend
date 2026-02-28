import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocalOtpProvider, DEV_OTP_BYPASS } from './local-otp.provider';
import { SMS_SERVICE } from '../../../sms/sms.interface';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockSms = { sendOtp: jest.fn().mockResolvedValue(undefined) };

describe('LocalOtpProvider', () => {
  let provider: LocalOtpProvider;
  let prisma: any;

  const phone = '+34600000000';

  beforeEach(async () => {
    prisma = {
      otpCode: {
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalOtpProvider,
        { provide: PrismaService, useValue: prisma },
        { provide: SMS_SERVICE, useValue: mockSms },
      ],
    }).compile();

    provider = module.get<LocalOtpProvider>(LocalOtpProvider);
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('requestOtp', () => {
    it('should create OTP and return success (and devOtp in dev)', async () => {
      const orig = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      prisma.otpCode.count.mockResolvedValue(0);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({});

      const result = await provider.requestOtp(phone);

      expect(result.success).toBe(true);
      expect(result.devOtp).toBeDefined();
      expect(result.devOtp).toMatch(/^[0-9]{6}$/);
      expect(prisma.otpCode.create).toHaveBeenCalled();
      process.env.NODE_ENV = orig;
    });

    it('should throw OTP_RATE_LIMIT when too many requests for phone', async () => {
      prisma.otpCode.count.mockResolvedValue(5);

      let err: any;
      try {
        await provider.requestOtp(phone);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_RATE_LIMIT');
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    const validRecord = {
      id: 1,
      phone,
      codeHash: 'hashed',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };

    it('should accept valid code (bcrypt match)', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      prisma.otpCode.update.mockResolvedValue({});

      await expect(provider.verifyCode(phone, '123456')).resolves.toBeUndefined();
      expect(prisma.otpCode.update).toHaveBeenCalled();
    });

    it('should allow dev bypass code only in development', async () => {
      process.env.NODE_ENV = 'development';
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      prisma.otpCode.update.mockResolvedValue({});

      await expect(provider.verifyCode(phone, DEV_OTP_BYPASS)).resolves.toBeUndefined();
      expect(bcrypt.compare).not.toHaveBeenCalled();
      process.env.NODE_ENV = 'test';
    });

    it('should throw OTP_EXPIRED when no active OTP', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      let err: any;
      try {
        await provider.verifyCode(phone, '123456');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_EXPIRED');
    });

    it('should throw OTP_INVALID when code is wrong', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpCode.update.mockResolvedValue({});

      let err: any;
      try {
        await provider.verifyCode(phone, '999999');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_INVALID');
    });

    it('should throw OTP_TOO_MANY_ATTEMPTS after max attempts', async () => {
      const recordMax = { ...validRecord, attempts: 4 };
      prisma.otpCode.findFirst.mockResolvedValue(recordMax);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpCode.update.mockResolvedValue({});

      let err: any;
      try {
        await provider.verifyCode(phone, 'wrong');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response?.code).toBe('OTP_TOO_MANY_ATTEMPTS');
    });
  });
});
