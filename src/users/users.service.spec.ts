import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'USER',
    avatarUrl: null,
    createdAt: new Date(),
    stores: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('should return user data without password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(1);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          stores: true,
        },
      });
      expect(result).toEqual(mockUser);
      expect(result).not.toHaveProperty('password');
    });

    it('should return null if user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.getMe(999);

      expect(result).toBeNull();
    });
  });

  describe('updateAvatar', () => {
    it('should update user avatar URL', async () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      const updatedUser = { ...mockUser, avatarUrl };

      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateAvatar(1, avatarUrl);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { avatarUrl },
      });
      expect(result.avatarUrl).toBe(avatarUrl);
    });
  });
});
