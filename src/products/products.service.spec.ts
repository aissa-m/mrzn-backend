import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/services/ownership.service';
import { S3Service } from '../s3/s3.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: jest.Mocked<PrismaService>;
  let ownershipService: jest.Mocked<OwnershipService>;
  let s3Service: jest.Mocked<S3Service>;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    description: 'Test Description',
    price: new Prisma.Decimal('10.50'),
    storeId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    images: [],
    store: { id: 1, ownerId: 1 },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      productImage: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockOwnershipService = {
      isStoreOwner: jest.fn(),
    };

    const mockS3Service = {
      uploadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OwnershipService, useValue: mockOwnershipService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get(PrismaService);
    ownershipService = module.get(OwnershipService);
    s3Service = module.get(S3Service);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateProductDto = {
      name: 'Test Product',
      description: 'Test Description',
      price: 10.5,
      storeId: 1,
    };

    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
    } as Express.Multer.File;

    it('should create a product successfully', async () => {
      prismaService.product.create.mockResolvedValue(mockProduct);
      s3Service.uploadFile.mockResolvedValue({ url: 'http://test.com/image.jpg', key: 'key' });
      prismaService.productImage.createMany.mockResolvedValue({ count: 1 });
      prismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        images: [{ id: 1, url: 'http://test.com/image.jpg', productId: 1 }],
      });

      const result = await service.create(1, createDto, [mockFile]);

      expect(prismaService.product.create).toHaveBeenCalled();
      expect(s3Service.uploadFile).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create product without images', async () => {
      prismaService.product.create.mockResolvedValue(mockProduct);
      prismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.create(1, createDto, []);

      expect(prismaService.product.create).toHaveBeenCalled();
      expect(s3Service.uploadFile).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ConflictException on duplicate name', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('', {
        code: 'P2002',
        clientVersion: '1.0.0',
      });
      prismaService.product.create.mockRejectedValue(error);

      await expect(service.create(1, createDto, [])).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if all uploads fail', async () => {
      prismaService.product.create.mockResolvedValue(mockProduct);
      s3Service.uploadFile.mockRejectedValue(new Error('Upload failed'));

      await expect(service.create(1, createDto, [mockFile])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      prismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(1);

      expect(prismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          images: true,
          store: { select: { id: true, ownerId: true } },
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if product does not exist', async () => {
      prismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByStore', () => {
    it('should return all products for a store', async () => {
      prismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAllByStore(1);

      expect(prismaService.product.findMany).toHaveBeenCalledWith({
        where: { storeId: 1 },
        include: { images: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    const updateDto: UpdateProductDto = {
      name: 'Updated Product',
      price: 15.0,
    };

    it('should update a product successfully', async () => {
      prismaService.product.findUnique.mockResolvedValue(mockProduct);
      ownershipService.isStoreOwner.mockResolvedValue(true);
      prismaService.product.update.mockResolvedValue({
        ...mockProduct,
        name: 'Updated Product',
      });
      prismaService.product.findUnique.mockResolvedValueOnce(mockProduct).mockResolvedValueOnce({
        ...mockProduct,
        name: 'Updated Product',
      });

      const result = await service.update(1, 1, updateDto, []);

      expect(ownershipService.isStoreOwner).toHaveBeenCalledWith(1, 1);
      expect(prismaService.product.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if product does not exist', async () => {
      prismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.update(1, 999, updateDto, [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not store owner', async () => {
      prismaService.product.findUnique.mockResolvedValue(mockProduct);
      ownershipService.isStoreOwner.mockResolvedValue(false);

      await expect(service.update(1, 1, updateDto, [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a product successfully', async () => {
      prismaService.product.findUnique.mockResolvedValue(mockProduct);
      ownershipService.isStoreOwner.mockResolvedValue(true);
      prismaService.product.delete.mockResolvedValue(mockProduct);

      const result = await service.remove(1, 1);

      expect(ownershipService.isStoreOwner).toHaveBeenCalledWith(1, 1);
      expect(prismaService.product.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({ ok: true });
    });

    it('should throw ForbiddenException if user is not store owner', async () => {
      prismaService.product.findUnique.mockResolvedValue(mockProduct);
      ownershipService.isStoreOwner.mockResolvedValue(false);

      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findManyWithQuery', () => {
    it('should return paginated products', async () => {
      const queryDto = { page: 1, limit: 10 };
      prismaService.$transaction.mockResolvedValue([[mockProduct], 1]);

      const result = await service.findManyWithQuery(queryDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(1);
    });
  });
});

