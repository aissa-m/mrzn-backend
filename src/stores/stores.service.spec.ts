import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StoresService } from './stores.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/services/ownership.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

describe('StoresService', () => {
  let service: StoresService;
  let prismaService: jest.Mocked<PrismaService>;
  let ownershipService: jest.Mocked<OwnershipService>;

  const mockStore = {
    id: 1,
    name: 'Test Store',
    ownerId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      store: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockOwnershipService = {
      isStoreOwnerOrAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OwnershipService, useValue: mockOwnershipService },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    prismaService = module.get(PrismaService);
    ownershipService = module.get(OwnershipService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a store', async () => {
      const createDto: CreateStoreDto = { name: 'Test Store' };
      prismaService.store.create.mockResolvedValue(mockStore);

      const result = await service.create(1, createDto);

      expect(prismaService.store.create).toHaveBeenCalledWith({
        data: { name: createDto.name, ownerId: 1 },
      });
      expect(result).toEqual(mockStore);
    });
  });

  describe('findAllByOwner', () => {
    it('should return all stores for an owner', async () => {
      prismaService.store.findMany.mockResolvedValue([mockStore]);

      const result = await service.findAllByOwner(1);

      expect(prismaService.store.findMany).toHaveBeenCalledWith({
        where: { ownerId: 1 },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockStore]);
    });
  });

  describe('findOne', () => {
    it('should return a store by id', async () => {
      prismaService.store.findUnique.mockResolvedValue(mockStore);

      const result = await service.findOne(1);

      expect(prismaService.store.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockStore);
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
      prismaService.store.findUnique.mockResolvedValue(mockStore);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(true);
      prismaService.store.update.mockResolvedValue({ ...mockStore, name: 'Updated Store' });

      const result = await service.update(user, 1, updateDto);
      expect(ownershipService.isStoreOwnerOrAdmin).toHaveBeenCalledWith(user, 1);

      expect(ownershipService.isStoreOwnerOrAdmin).toHaveBeenCalledWith(
        { id: 1, role: 'STORE_OWNER' },
        1,
      );
      expect(prismaService.store.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateDto,
      });
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if user is not owner or admin', async () => {
      const user = { id: 2, role: 'USER' as const };
      prismaService.store.findUnique.mockResolvedValue(mockStore);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(false);

      await expect(service.update(user, 1, updateDto)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete a store and its products', async () => {
      const user = { id: 1, role: 'STORE_OWNER' as const };
      prismaService.store.findUnique.mockResolvedValue(mockStore);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(true);
      prismaService.$transaction.mockResolvedValue([null, mockStore]);

      const result = await service.remove(user, 1);

      expect(ownershipService.isStoreOwnerOrAdmin).toHaveBeenCalled();
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('should throw ForbiddenException if user is not owner or admin', async () => {
      const user = { id: 2, role: 'USER' as const };
      prismaService.store.findUnique.mockResolvedValue(mockStore);
      ownershipService.isStoreOwnerOrAdmin.mockResolvedValue(false);

      await expect(service.remove(user, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});

