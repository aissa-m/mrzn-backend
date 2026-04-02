import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoresService } from './stores.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/services/ownership.service';
import { SellerContextService } from '../common/services/seller-context.service';
import { S3Service } from '../s3/s3.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

describe('StoresService', () => {
  let service: StoresService;
  let prismaService: jest.Mocked<PrismaService>;
  let ownershipService: jest.Mocked<OwnershipService>;
  let s3Service: jest.Mocked<S3Service>;

  const mockStore = {
    id: 1,
    name: 'Test Store',
    ownerId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    logoUrl: null as string | null,
    bannerUrl: null as string | null,
    logoImageUrl: null as string | null,
    coverImageUrl: null as string | null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      store: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      product: {
        count: jest.fn(),
      },
      user: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const mockOwnershipService = {
      isStoreOwnerOrAdmin: jest.fn(),
    };

    const mockSellerContext = {
      getSellerContext: jest.fn(),
    };

    const mockS3 = {
      uploadFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OwnershipService, useValue: mockOwnershipService },
        { provide: SellerContextService, useValue: mockSellerContext },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    prismaService = module.get(PrismaService);
    ownershipService = module.get(OwnershipService);
    s3Service = module.get(S3Service);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a store', async () => {
      const createDto: CreateStoreDto = { name: 'Test Store' };
      prismaService.store.count.mockResolvedValue(0);
      prismaService.store.create.mockResolvedValue(mockStore as any);
      prismaService.user.findUnique.mockResolvedValue({ role: 'USER' } as any);
      prismaService.user.update.mockResolvedValue({} as any);

      const result = await service.create(1, createDto);

      expect(prismaService.store.count).toHaveBeenCalledWith({ where: { ownerId: 1 } });
      expect(prismaService.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: createDto.name,
            ownerId: 1,
          }),
        }),
      );
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { sellerMode: 'STORE', role: 'STORE_OWNER' },
      });
      expect(s3Service.uploadFile).not.toHaveBeenCalled();
      expect(result).toEqual(mockStore);
    });

    it('should upload logo/banner after create when files provided', async () => {
      const createDto: CreateStoreDto = { name: 'Test Store' };
      prismaService.store.count.mockResolvedValue(0);
      prismaService.store.create.mockResolvedValue(mockStore as any);
      prismaService.user.findUnique.mockResolvedValue({ role: 'USER' } as any);
      prismaService.store.update.mockResolvedValue({
        ...mockStore,
        logoUrl: 'https://cdn/logo.png',
        bannerUrl: 'https://cdn/banner.png',
      } as any);
      prismaService.user.update.mockResolvedValue({} as any);
      s3Service.uploadFile
        .mockResolvedValueOnce({ url: 'https://cdn/logo.png', key: 'k1' })
        .mockResolvedValueOnce({ url: 'https://cdn/banner.png', key: 'k2' });

      const logo = {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'l.png',
      } as Express.Multer.File;
      const banner = {
        buffer: Buffer.from('y'),
        mimetype: 'image/jpeg',
        originalname: 'b.jpg',
      } as Express.Multer.File;

      const result = await service.create(1, createDto, {
        logo: [logo],
        banner: [banner],
      });

      expect(s3Service.uploadFile).toHaveBeenCalledTimes(2);
      expect(s3Service.uploadFile).toHaveBeenCalledWith(logo, 'stores/1');
      expect(s3Service.uploadFile).toHaveBeenCalledWith(banner, 'stores/1');
      expect(prismaService.store.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { logoUrl: 'https://cdn/logo.png', bannerUrl: 'https://cdn/banner.png' },
      });
      expect(result.logoUrl).toBe('https://cdn/logo.png');
      expect(result.bannerUrl).toBe('https://cdn/banner.png');
    });
  });

  describe('findAllByOwner', () => {
    it('should return all stores for an owner', async () => {
      prismaService.store.findMany.mockResolvedValue([
        { ...mockStore, _count: { products: 2 } },
      ] as any);

      const result = await service.findAllByOwner(1);

      expect(prismaService.store.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 1 },
        }),
      );
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: mockStore.id,
          productsCount: 2,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a store by id', async () => {
      prismaService.store.findUnique.mockResolvedValue({
        ...mockStore,
        _count: { products: 0 },
      } as any);

      const result = await service.findOne(1);

      expect(prismaService.store.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          ...mockStore,
          productsCount: 0,
        }),
      );
    });

    it('should throw NotFoundException if store does not exist', async () => {
      prismaService.store.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateStoreDto = { name: 'Updated Store' };

    it('should update a store successfully', async () => {
      const user = { id: 1, role: 'STORE_OWNER' as const };
      prismaService.store.findUnique.mockResolvedValue({
        id: mockStore.id,
        ownerId: mockStore.ownerId,
        name: mockStore.name,
      } as any);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(true);
      prismaService.store.update.mockResolvedValue({
        ...mockStore,
        name: 'Updated Store',
      } as any);

      const result = await service.update(user, 1, updateDto);

      expect(ownershipService.isStoreOwnerOrAdmin).toHaveBeenCalledWith(user, 1);
      expect(prismaService.store.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ name: 'Updated Store' }),
      });
      expect(result).toBeDefined();
    });

    it('should apply uploaded logo URL over dto logoUrl', async () => {
      const user = { id: 1, role: 'STORE_OWNER' as const };
      prismaService.store.findUnique.mockResolvedValue({
        id: mockStore.id,
        ownerId: mockStore.ownerId,
        name: mockStore.name,
      } as any);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(true);
      prismaService.store.update.mockResolvedValue({
        ...mockStore,
        logoUrl: 'https://new/logo.png',
      } as any);
      s3Service.uploadFile.mockResolvedValue({ url: 'https://new/logo.png', key: 'k' });
      const logo = {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'l.png',
      } as Express.Multer.File;

      await service.update(user, 1, { logoUrl: 'https://old/logo.png' }, { logo: [logo] });

      expect(prismaService.store.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ logoUrl: 'https://new/logo.png' }),
      });
    });

    it('should throw ForbiddenException if user is not owner or admin', async () => {
      const user = { id: 2, role: 'USER' as const };
      prismaService.store.findUnique.mockResolvedValue({
        id: mockStore.id,
        ownerId: mockStore.ownerId,
        name: mockStore.name,
      } as any);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(false);

      await expect(service.update(user, 1, updateDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when store does not exist', async () => {
      const user = { id: 1, role: 'USER' as const };
      prismaService.store.findUnique.mockResolvedValue(null);

      await expect(service.update(user, 999, updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should allow USER role when JWT role is USER but ownerId matches', async () => {
      const user = { id: 1, role: 'USER' as const };
      prismaService.store.findUnique.mockResolvedValue({
        id: 1,
        ownerId: 1,
        name: 'Owned',
      } as any);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(true);
      prismaService.store.update.mockResolvedValue({ ...mockStore, name: 'Updated Store' } as any);

      await service.update(user, 1, updateDto);

      expect(ownershipService.isStoreOwnerOrAdmin).toHaveBeenCalledWith(user, 1);
      expect(prismaService.store.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a store without products', async () => {
      const user = { id: 1, role: 'STORE_OWNER' as const };
      prismaService.store.findUnique.mockResolvedValue({
        ...mockStore,
        _count: { products: 0 },
      } as any);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(true);
      prismaService.product.count.mockResolvedValue(0);
      prismaService.store.delete.mockResolvedValue(mockStore as any);
      prismaService.user.findUnique.mockResolvedValue({ role: 'STORE_OWNER' } as any);
      prismaService.user.update.mockResolvedValue({} as any);

      const result = await service.remove(user, 1);

      expect(ownershipService.isStoreOwnerOrAdmin).toHaveBeenCalled();
      expect(prismaService.store.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { sellerMode: 'PERSONAL', role: 'USER' },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should throw ForbiddenException if user is not owner or admin', async () => {
      const user = { id: 2, role: 'USER' as const };
      prismaService.store.findUnique.mockResolvedValue({
        ...mockStore,
        _count: { products: 0 },
      } as any);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(false);

      await expect(service.remove(user, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});
