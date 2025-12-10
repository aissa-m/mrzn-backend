import { Test, TestingModule } from '@nestjs/testing';
import { OwnershipService } from './ownership.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OwnershipService', () => {
  let service: OwnershipService;
  let prismaService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      store: {
        count: jest.fn(),
      },
      product: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OwnershipService>(OwnershipService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('isStoreOwner', () => {
    it('should return true if user is store owner', async () => {
      prismaService.store.count.mockResolvedValue(1);

      const result = await service.isStoreOwner(1, 1);

      expect(prismaService.store.count).toHaveBeenCalledWith({
        where: { id: 1, ownerId: 1 },
      });
      expect(result).toBe(true);
    });

    it('should return false if user is not store owner', async () => {
      prismaService.store.count.mockResolvedValue(0);

      const result = await service.isStoreOwner(1, 1);

      expect(result).toBe(false);
    });
  });

  describe('isStoreOwnerOrAdmin', () => {
    it('should return true if user is admin', async () => {
      const result = await service.isStoreOwnerOrAdmin(
        { id: 1, role: 'ADMIN' },
        1,
      );

      expect(result).toBe(true);
      expect(prismaService.store.count).not.toHaveBeenCalled();
    });

    it('should return true if user is store owner', async () => {
      prismaService.store.count.mockResolvedValue(1);

      const result = await service.isStoreOwnerOrAdmin(
        { id: 1, role: 'STORE_OWNER' },
        1,
      );

      expect(result).toBe(true);
      expect(prismaService.store.count).toHaveBeenCalled();
    });

    it('should return false if user is not owner and not admin', async () => {
      prismaService.store.count.mockResolvedValue(0);

      const result = await service.isStoreOwnerOrAdmin(
        { id: 1, role: 'USER' },
        1,
      );

      expect(result).toBe(false);
    });
  });

  describe('isProductOwner', () => {
    it('should return true if user owns the product', async () => {
      prismaService.product.count.mockResolvedValue(1);

      const result = await service.isProductOwner(1, 1);

      expect(prismaService.product.count).toHaveBeenCalledWith({
        where: { id: 1, store: { ownerId: 1 } },
      });
      expect(result).toBe(true);
    });

    it('should return false if user does not own the product', async () => {
      prismaService.product.count.mockResolvedValue(0);

      const result = await service.isProductOwner(1, 1);

      expect(result).toBe(false);
    });
  });
});

