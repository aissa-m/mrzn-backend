import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { NotFoundException } from '@nestjs/common';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let favoritesService: jest.Mocked<FavoritesService>;

  const mockUser = { id: 1 };

  beforeEach(async () => {
    const mockFavoritesService = {
      getFavorites: jest.fn(),
      getFavoriteIds: jest.fn(),
      toggle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [{ provide: FavoritesService, useValue: mockFavoritesService }],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
    favoritesService = module.get(FavoritesService);

    jest.clearAllMocks();
  });

  describe('getFavorites', () => {
    it('should return paginated favorites for user', async () => {
      const result = { meta: { page: 1, limit: 20, total: 0, pages: 1 }, items: [] };
      favoritesService.getFavorites.mockResolvedValue(result);

      const out = await controller.getFavorites(mockUser, {});

      expect(favoritesService.getFavorites).toHaveBeenCalledWith(1, 1, 20);
      expect(out).toEqual(result);
    });

    it('should pass page and limit from query', async () => {
      favoritesService.getFavorites.mockResolvedValue({ meta: {}, items: [] });

      await controller.getFavorites(mockUser, { page: 2, limit: 10 });

      expect(favoritesService.getFavorites).toHaveBeenCalledWith(1, 2, 10);
    });
  });

  describe('getFavoriteIds', () => {
    it('should return array of product IDs', async () => {
      favoritesService.getFavoriteIds.mockResolvedValue([1, 2, 3]);

      const out = await controller.getFavoriteIds(mockUser);

      expect(favoritesService.getFavoriteIds).toHaveBeenCalledWith(1);
      expect(out).toEqual([1, 2, 3]);
    });
  });

  describe('toggle', () => {
    it('should return { liked: true } when adding', async () => {
      favoritesService.toggle.mockResolvedValue({ liked: true });

      const out = await controller.toggle(mockUser, 5);

      expect(favoritesService.toggle).toHaveBeenCalledWith(1, 5);
      expect(out).toEqual({ liked: true });
    });

    it('should return { liked: false } when removing', async () => {
      favoritesService.toggle.mockResolvedValue({ liked: false });

      const out = await controller.toggle(mockUser, 5);

      expect(out).toEqual({ liked: false });
    });

    it('should propagate 404 when product not found', async () => {
      favoritesService.toggle.mockRejectedValue(new NotFoundException('Product not found'));

      await expect(controller.toggle(mockUser, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
