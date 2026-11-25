import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OtpService } from './otp.service';
import { OTP_PROVIDER } from './interfaces/otp-provider.interface';

const mockOtpProvider = {
  requestOtp: jest.fn(),
  verifyCode: jest.fn(),
};

describe('OtpService', () => {
  let service: OtpService;
  let prisma: any;

  const phone = '+34600000000';
  const desiredRole = 'USER' as const;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: OTP_PROVIDER, useValue: mockOtpProvider },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    jest.clearAllMocks();
    mockOtpProvider.requestOtp.mockResolvedValue({ success: true });
    mockOtpProvider.verifyCode.mockResolvedValue(undefined);
  });

  describe('requestOtp', () => {
    it('should delegate to provider and return success', async () => {
      const result = await service.requestOtp(phone, desiredRole);

      expect(result.success).toBe(true);
      expect(mockOtpProvider.requestOtp).toHaveBeenCalledWith(phone.trim());
    });

    it('should propagate OTP_RATE_LIMIT from provider', async () => {
      mockOtpProvider.requestOtp.mockRejectedValue(
        new BadRequestException({ code: 'OTP_RATE_LIMIT', message: 'Too many requests' }),
      );

      await expect(service.requestOtp(phone, desiredRole)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyOtp', () => {
    it('should verify via provider then return new user when no user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 1,
        phone: '+34600000000',
        role: 'USER',
        name: null,
        email: null,
        password: null,
        stores: [],
      });

      const user = await service.verifyOtp(phone, '123456', desiredRole);

      expect(mockOtpProvider.verifyCode).toHaveBeenCalledWith(phone.trim(), '123456');
      expect(user.id).toBe(1);
      expect(user.role).toBe('USER');
      expect(user.phone).toBe(phone);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          phone: '+34600000000',
          role: 'USER',
          name: null,
          email: null,
          password: null,
        },
        include: { stores: true },
      });
    });

    it('should create new user as STORE_OWNER when legacy app sends desiredRole STORE_OWNER', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 3,
        phone: '+34600000000',
        role: 'STORE_OWNER',
        name: null,
        email: null,
        password: null,
        stores: [],
      });

      await service.verifyOtp(phone, '123456', 'STORE_OWNER');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'STORE_OWNER' }),
        }),
      );
    });

    it('should create new user as USER when desiredRole is omitted', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 4,
        phone: '+34600000000',
        role: 'USER',
        name: null,
        email: null,
        password: null,
        stores: [],
      });

      await service.verifyOtp(phone, '123456');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'USER' }),
        }),
      );
    });

    it('should propagate OTP_EXPIRED from provider and not touch user', async () => {
      mockOtpProvider.verifyCode.mockRejectedValue(
        new BadRequestException({ code: 'OTP_EXPIRED', message: 'Expired' }),
      );

      await expect(service.verifyOtp(phone, '123456', desiredRole)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return existing user even when role differs from desiredRole', async () => {
      const existingUser = {
        id: 3,
        phone,
        role: 'STORE_OWNER',
        name: 'Juan',
        email: null,
        password: null,
        stores: [],
      };
      mockOtpProvider.verifyCode.mockResolvedValue(undefined);
      prisma.user.findUnique.mockResolvedValue(existingUser);

      const user = await service.verifyOtp(phone, '123456', 'USER');

      expect(user.id).toBe(3);
      expect(user.role).toBe('STORE_OWNER');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });
});
