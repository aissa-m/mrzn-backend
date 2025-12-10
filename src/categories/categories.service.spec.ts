// src/categories/categories.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Prisma } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: jest.Mocked<PrismaService> & {
    category: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockCategory = {
    id: 1,
    name: 'Test Category',
    description: 'Test Description',
    slug: 'test-category',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { products: 0 },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      category: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get(PrismaService) as typeof prismaService;

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCategoryDto = {
      name: 'Test Category',
      description: 'Test Description',
    };

    it('should create a category successfully', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);
      prismaService.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(createDto);

      expect(prismaService.category.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.name).toBe(createDto.name);
    });

    it('should throw ConflictException on duplicate name', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('', {
        code: 'P2002',
        clientVersion: '1.0.0',
      });
      prismaService.category.findUnique.mockResolvedValue(null);
      prismaService.category.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne(1);

      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw NotFoundException if category does not exist', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return a category by slug', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findBySlug('test-category');

      expect(prismaService.category.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-category' },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
      expect(result).toBeDefined();
      expect(result.slug).toBe('test-category');
    });

    it('should throw NotFoundException if category does not exist', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated categories', async () => {
      const queryDto = { page: 1, limit: 10 };
      prismaService.$transaction.mockResolvedValue([[mockCategory], 1]);

      const result = await service.findAll(queryDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search term', async () => {
      const queryDto = { search: 'test', page: 1, limit: 10 };
      prismaService.$transaction.mockResolvedValue([[mockCategory], 1]);

      const result = await service.findAll(queryDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCategoryDto = {
      name: 'Updated Category',
    };

    it('should update a category successfully', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory);
      prismaService.category.findUnique.mockResolvedValueOnce(mockCategory).mockResolvedValueOnce(null);
      prismaService.category.update.mockResolvedValue({
        ...mockCategory,
        name: 'Updated Category',
      });

      const result = await service.update(1, updateDto);

      expect(prismaService.category.findUnique).toHaveBeenCalled();
      expect(prismaService.category.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if category does not exist', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on duplicate name', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('', {
        code: 'P2002',
        clientVersion: '1.0.0',
      });
      prismaService.category.findUnique.mockResolvedValue(mockCategory);
      prismaService.category.findUnique.mockResolvedValueOnce(mockCategory).mockResolvedValueOnce(null);
      prismaService.category.update.mockRejectedValue(error);

      await expect(service.update(1, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a category successfully', async () => {
      prismaService.category.findUnique.mockResolvedValue(mockCategory);
      prismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove(1);

      expect(prismaService.category.findUnique).toHaveBeenCalled();
      expect(prismaService.category.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should throw NotFoundException if category does not exist', async () => {
      prismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if category has products', async () => {
      prismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        _count: { products: 5 },
      });

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });
  });
});

