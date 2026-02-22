import { Test, TestingModule } from '@nestjs/testing';
import { AdminCategoriesController } from '../admin-categories.controller';
import { CategoriesService } from '../../../categories/categories.service';
import { CreateCategoryDto } from '../../../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../../../categories/dto/update-category.dto';

describe('AdminCategoriesController', () => {
  let controller: AdminCategoriesController;
  let categoriesService: jest.Mocked<CategoriesService>;

  const mockCategory = {
    id: 1,
    name: 'Test Category',
    description: 'Test Description',
    slug: 'test-category',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCategoriesService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCategoriesController],
      providers: [
        { provide: CategoriesService, useValue: mockCategoriesService },
      ],
    }).compile();

    controller = module.get<AdminCategoriesController>(
      AdminCategoriesController,
    );
    categoriesService = module.get(CategoriesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated categories', async () => {
      const query = { page: 1, limit: 10 };
      const mockResult = {
        items: [mockCategory],
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      };
      categoriesService.findAll.mockResolvedValue(mockResult as any);

      const result = await controller.findAll(query);

      expect(categoriesService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should call findAll with undefined when no query', async () => {
      categoriesService.findAll.mockResolvedValue({
        items: [],
        meta: { total: 0, page: 1, limit: 20, pages: 0 },
      } as any);

      await controller.findAll(undefined);

      expect(categoriesService.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      categoriesService.findOne.mockResolvedValue(mockCategory as any);

      const result = await controller.findOne(1);

      expect(categoriesService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const createDto: CreateCategoryDto = {
        name: 'Test Category',
        description: 'Test Description',
      };
      categoriesService.create.mockResolvedValue(mockCategory as any);

      const result = await controller.create(createDto);

      expect(categoriesService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const updateDto: UpdateCategoryDto = { name: 'Updated Category' };
      categoriesService.update.mockResolvedValue({
        ...mockCategory,
        name: 'Updated Category',
      } as any);

      const result = await controller.update(1, updateDto);

      expect(categoriesService.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      categoriesService.remove.mockResolvedValue({ ok: true } as any);

      const result = await controller.remove(1);

      expect(categoriesService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ ok: true });
    });
  });
});
