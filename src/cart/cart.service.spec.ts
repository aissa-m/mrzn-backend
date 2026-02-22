import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CartService', () => {
  let service: CartService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      cart: { findUnique: jest.fn(), create: jest.fn() },
      cartItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getOrCreateCart', () => {
    it('should create cart when user has none', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      const newCart = {
        id: 1,
        userId: 1,
        items: [],
      };
      prisma.cart.create.mockResolvedValue(newCart as any);

      const result = await service.getOrCreateCart(1);

      expect(prisma.cart.create).toHaveBeenCalled();
      expect(prisma.cart.create.mock.calls[0][0].data).toEqual({ userId: 1 });
      expect(result.id).toBe(1);
      expect(result.items).toEqual([]);
    });

    it('should return existing cart with items', async () => {
      const cart = {
        id: 1,
        userId: 1,
        items: [
          {
            id: 1,
            productId: 1,
            quantity: 2,
            product: { id: 1, name: 'P1', price: 10, images: [], store: {}, category: {} },
          },
        ],
      };
      prisma.cart.findUnique.mockResolvedValue(cart as any);

      const result = await service.getOrCreateCart(1);

      expect(result.id).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(1);
      expect(result.items[0].quantity).toBe(2);
    });
  });

  describe('add', () => {
    it('should throw 404 if product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.add(1, { productId: 999, quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.add(1, { productId: 999, quantity: 1 })).rejects.toThrow(
        'Product not found',
      );
    });
  });

  describe('remove', () => {
    it('should throw 404 if cart item does not exist', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 1, userId: 1 } as any);
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.remove(1, 999)).rejects.toThrow(NotFoundException);
      await expect(service.remove(1, 999)).rejects.toThrow('Cart item not found');
    });
  });

  describe('update', () => {
    it('should throw BadRequestException for invalid quantity', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 1 } as any);
      prisma.cart.findUnique.mockResolvedValue({ id: 1, userId: 1 } as any);

      await expect(service.update(1, { productId: 1, quantity: -1 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(1, { productId: 1, quantity: -1 })).rejects.toThrow(
        'Invalid quantity',
      );
    });
  });
});
