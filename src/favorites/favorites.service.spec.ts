import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: any;

  beforeEach(async () => {
    const mockPrisma = {
      favorite: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getFavorites', () => {
    it('should return paginated favorites with products', async () => {
      const items = [
        {
          id: 1,
          userId: 1,
          productId: 1,
          product: {
            id: 1,
            name: 'P1',
            price: { toNumber: () => 10 },
            images: [{ url: '/img.jpg' }],
          },
        },
      ];
      prisma.$transaction.mockResolvedValue([items, 1]);

      const result = await service.getFavorites(1, 1, 20);

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(1);
    });
  });

  describe('getFavoriteIds', () => {
    it('should return product IDs', async () => {
      prisma.favorite.findMany.mockResolvedValue([{ productId: 1 }, { productId: 2 }]);

      const result = await service.getFavoriteIds(1);

      expect(result).toEqual([1, 2]);
    });
  });

  describe('toggle', () => {
    it('should throw 404 if product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.toggle(1, 999)).rejects.toThrow(NotFoundException);
      await expect(service.toggle(1, 999)).rejects.toThrow('Product not found');
    });

    it('should delete and return liked false when favorite exists', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 1 });
      prisma.favorite.findUnique.mockResolvedValue({ id: 1, userId: 1, productId: 1 });
      prisma.favorite.delete.mockResolvedValue({});

      const result = await service.toggle(1, 1);

      expect(prisma.favorite.delete).toHaveBeenCalled();
      expect(result).toEqual({ liked: false });
    });

    it('should create and return liked true when favorite does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 1 });
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.create.mockResolvedValue({ id: 1, userId: 1, productId: 1 });

      const result = await service.toggle(1, 1);

      expect(prisma.favorite.create).toHaveBeenCalledWith({ data: { userId: 1, productId: 1 } });
      expect(result).toEqual({ liked: true });
    });
  });
});
