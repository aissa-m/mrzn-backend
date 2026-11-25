import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { SellerContextService } from '../common/services/seller-context.service';
import { UpdateMeDto } from './dto/update-me.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;
  let sellerContext: { getSellerContext: jest.Mock };

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    phone: '+34600000000',
    role: 'USER',
    sellerMode: 'PERSONAL',
    avatarUrl: null,
    createdAt: new Date(),
    stores: [],
    firstName: null,
    lastName: null,
    nni: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    country: null,
    birthDate: null,
    gender: null,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    sellerContext = {
      getSellerContext: jest.fn().mockResolvedValue({
        sellerMode: 'PERSONAL',
        store: null,
        canPublishAsStore: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: SellerContextService, useValue: sellerContext },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return user data without password and with personal info fields', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(1);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.objectContaining({
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          firstName: true,
          lastName: true,
          nni: true,
          addressLine1: true,
          city: true,
          country: true,
          avatarUrl: true,
          createdAt: true,
          sellerMode: true,
          stores: true,
        }),
      });
      expect(sellerContext.getSellerContext).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        ...mockUser,
        phone: mockUser.phone.trim(),
        store: null,
        canPublishAsStore: false,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should trim phone in getMe response', async () => {
      const raw = { ...mockUser, phone: '  +34600000000  ' };
      prismaService.user.findUnique.mockResolvedValue(raw);

      const result = await service.getMe(1);

      expect(result?.phone).toBe('+34600000000');
    });

    it('should return null if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getMe(999);

      expect(result).toBeNull();
    });
  });

  describe('updateMe', () => {
    it('should update only firstName (partial update)', async () => {
      const dto: UpdateMeDto = { firstName: 'Juan' };
      const updated = { ...mockUser, firstName: 'Juan' };
      prismaService.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(1, dto);

      expect(prismaService.user.findFirst).not.toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { firstName: 'Juan' },
        select: expect.any(Object),
      });
      expect(result.firstName).toBe('Juan');
    });

    it('should throw EMAIL_TAKEN when email already used by another user', async () => {
      const dto: UpdateMeDto = { email: 'other@example.com' };
      prismaService.user.findFirst.mockResolvedValue({ id: 2 });

      try {
        await service.updateMe(1, dto);
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.response?.code).toBe('EMAIL_TAKEN');
      }
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should throw NNI_TAKEN when nni already used by another user', async () => {
      const dto: UpdateMeDto = { nni: 'ABC12345' };
      prismaService.user.findFirst.mockResolvedValue({ id: 2 }); // nni taken by user 2

      try {
        await service.updateMe(1, dto);
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.response?.code).toBe('NNI_TAKEN');
      }
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('should not update role even if present in dto (role not in DTO so never passed)', async () => {
      const dto: UpdateMeDto = { firstName: 'Jane' };
      const updated = { ...mockUser, firstName: 'Jane' };
      prismaService.user.update.mockResolvedValue(updated);

      await service.updateMe(1, dto);

      const updateCall = prismaService.user.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('role');
      expect(updateCall.data).toEqual({ firstName: 'Jane' });
    });

    it('should accept valid email and update', async () => {
      const dto: UpdateMeDto = { email: 'new@example.com' };
      prismaService.user.findFirst.mockResolvedValue(null);
      const updated = { ...mockUser, email: 'new@example.com' };
      prismaService.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(1, dto);

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'new@example.com', id: { not: 1 } },
        select: { id: true },
      });
      expect(result.email).toBe('new@example.com');
    });
  });

  describe('clearPersonalInfo', () => {
    it('should set personal info fields to null', async () => {
      const updated = { ...mockUser, firstName: null, lastName: null, nni: null };
      prismaService.user.update.mockResolvedValue(updated);

      const result = await service.clearPersonalInfo(1);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          firstName: null,
          lastName: null,
          nni: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          country: null,
          birthDate: null,
          gender: null,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('updateAvatar', () => {
    it('should update user avatar URL', async () => {
      const avatarUrl = '/uploads/avatars/1-123.jpg';
      const updatedUser = { ...mockUser, avatarUrl };

      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateAvatar(1, avatarUrl);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { avatarUrl },
        select: expect.any(Object),
      });
      expect(result.avatarUrl).toBe(avatarUrl);
    });
  });
});
