import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { NotFoundException } from '@nestjs/common';

describe('CartController', () => {
  let controller: CartController;
  let cartService: jest.Mocked<CartService>;

  const mockUser = { id: 1 };

  beforeEach(async () => {
    const mockCartService = {
      getOrCreateCart: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    }).compile();

    controller = module.get<CartController>(CartController);
    cartService = module.get(CartService);

    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return cart for user', async () => {
      const cart = { id: 1, items: [], subtotal: 0 };
      cartService.getOrCreateCart.mockResolvedValue(cart);

      const result = await controller.getCart(mockUser);

      expect(cartService.getOrCreateCart).toHaveBeenCalledWith(1);
      expect(result).toEqual(cart);
    });
  });

  describe('add', () => {
    it('should add item and return cart', async () => {
      const dto = { productId: 1, quantity: 2 };
      const cart = { id: 1, items: [{ productId: 1, quantity: 2, product: {} }], subtotal: 20 };
      cartService.add.mockResolvedValue(cart);

      const result = await controller.add(mockUser, dto);

      expect(cartService.add).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(cart);
    });
  });

  describe('update', () => {
    it('should update quantity and return cart', async () => {
      const dto = { productId: 1, quantity: 3 };
      cartService.update.mockResolvedValue({ id: 1, items: [], subtotal: 0 });

      await controller.update(mockUser, dto);

      expect(cartService.update).toHaveBeenCalledWith(1, dto);
    });

    it('should propagate 404', async () => {
      cartService.update.mockRejectedValue(new NotFoundException('Cart item not found'));

      await expect(controller.update(mockUser, { productId: 99, quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove item and return cart', async () => {
      cartService.remove.mockResolvedValue({ id: 1, items: [], subtotal: 0 });

      await controller.remove(mockUser, 1);

      expect(cartService.remove).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('clear', () => {
    it('should clear cart', async () => {
      cartService.clear.mockResolvedValue({ id: 1, items: [], subtotal: 0 });

      const result = await controller.clear(mockUser);

      expect(cartService.clear).toHaveBeenCalledWith(1);
      expect(result.items).toEqual([]);
    });
  });
});
