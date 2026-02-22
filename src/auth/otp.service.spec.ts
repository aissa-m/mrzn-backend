import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService, DEV_OTP_BYPASS } from './otp.service';
import { SMS_SERVICE } from '../sms/sms.interface';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockSms = { sendOtp: jest.fn().mockResolvedValue(undefined) };

describe('OtpService', () => {
  let service: OtpService;
  let prisma: any;

  const phone = '+34600000000';
  const desiredRole = 'USER' as const;

  beforeEach(async () => {
    prisma = {
      otpCode: {
        count: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: SMS_SERVICE, useValue: mockSms },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
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

      const result = await service.requestOtp(phone, desiredRole);

      expect(result.success).toBe(true);
      expect(result.devOtp).toBeDefined();
      expect(result.devOtp).toMatch(/^[0-9]{6}$/);
      expect(prisma.otpCode.create).toHaveBeenCalled();
      process.env.NODE_ENV = orig;
    });

    it('should throw OTP_RATE_LIMIT when too many requests for phone', async () => {
      prisma.otpCode.count.mockResolvedValue(5);

      try {
        await service.requestOtp(phone, desiredRole);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response?.code).toBe('OTP_RATE_LIMIT');
      }
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    const validRecord = {
      id: 1,
      phone,
      codeHash: 'hashed',
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
    };

    it('should return user and allow dev bypass code in development', async () => {
      process.env.NODE_ENV = 'development';
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 1,
        phone,
        role: 'USER',
        name: null,
        email: null,
        password: null,
        stores: [],
      });

      const user = await service.verifyOtp(phone, DEV_OTP_BYPASS, desiredRole);

      expect(user.id).toBe(1);
      expect(user.role).toBe('USER');
      expect(user.phone).toBe(phone);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          phone,
          role: 'USER',
          name: null,
          email: null,
          password: null,
        },
        include: { stores: true },
      });
    });

    it('should throw OTP_EXPIRED when no active OTP', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      try {
        await service.verifyOtp(phone, '123456', desiredRole);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response?.code).toBe('OTP_EXPIRED');
      }
    });

    it('should throw OTP_INVALID when code is wrong', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpCode.update.mockResolvedValue({});

      try {
        await service.verifyOtp(phone, '999999', desiredRole);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response?.code).toBe('OTP_INVALID');
      }
    });

    it('should throw OTP_TOO_MANY_ATTEMPTS after max attempts', async () => {
      const recordMax = { ...validRecord, attempts: 4 };
      prisma.otpCode.findFirst.mockResolvedValue(recordMax);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpCode.update.mockResolvedValue({});

      try {
        await service.verifyOtp(phone, 'wrong', desiredRole);
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.response?.code).toBe('OTP_TOO_MANY_ATTEMPTS');
      }
    });

    it('should throw ROLE_MISMATCH when existing user has different role', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        id: 2,
        phone,
        role: 'STORE_OWNER',
        name: null,
        email: null,
        password: null,
        stores: [],
      });

      try {
        await service.verifyOtp(phone, '123456', 'USER');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.response?.code).toBe('ROLE_MISMATCH');
        expect(e.response?.currentRole).toBe('STORE_OWNER');
      }
    });

    it('should return existing user when role matches', async () => {
      const existingUser = {
        id: 3,
        phone,
        role: 'USER',
        name: 'Juan',
        email: null,
        password: null,
        stores: [],
      };
      prisma.otpCode.findFirst.mockResolvedValue(validRecord);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(existingUser);

      const user = await service.verifyOtp(phone, '123456', desiredRole);

      expect(user.id).toBe(3);
      expect(user.role).toBe('USER');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
