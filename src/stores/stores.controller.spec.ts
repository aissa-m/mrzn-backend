import { Test, TestingModule } from '@nestjs/testing';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

describe('StoresController', () => {
  let controller: StoresController;
  let storesService: jest.Mocked<StoresService>;

  const mockStore = {
    id: 1,
    name: 'Test Store',
    ownerId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = { id: 1, email: 'test@example.com', role: 'STORE_OWNER' };

  beforeEach(async () => {
    const mockStoresService = {
      create: jest.fn(),
      findAllByOwner: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoresController],
      providers: [{ provide: StoresService, useValue: mockStoresService }],
    }).compile();

    controller = module.get<StoresController>(StoresController);
    storesService = module.get(StoresService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a store', async () => {
      const createDto: CreateStoreDto = { name: 'Test Store' };
      storesService.create.mockResolvedValue(mockStore);

      const result = await controller.create(mockUser, createDto);

      expect(storesService.create).toHaveBeenCalledWith(mockUser.id, createDto, undefined);
      expect(result).toEqual(mockStore);
    });
  });

  describe('findMine', () => {
    it('should return all stores for the current user', async () => {
      storesService.findAllByOwner.mockResolvedValue([mockStore]);

      const result = await controller.findMine(mockUser);

      expect(storesService.findAllByOwner).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockStore]);
    });
  });

  describe('findOne', () => {
    it('should return a store by id', async () => {
      storesService.findOne.mockResolvedValue(mockStore);

      const result = await controller.findOne('1');

      expect(storesService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockStore);
    });
  });

  describe('update', () => {
    it('should update a store', async () => {
      const updateDto: UpdateStoreDto = { name: 'Updated Store' };
      storesService.update.mockResolvedValue({ ...mockStore, name: 'Updated Store' });

      const result = await controller.update(mockUser, '1', updateDto);

      expect(storesService.update).toHaveBeenCalledWith(
        { id: mockUser.id, role: mockUser.role },
        1,
        updateDto,
        undefined,
      );
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a store', async () => {
      storesService.remove.mockResolvedValue({ ok: true });

      const result = await controller.remove(mockUser, '1');

      expect(storesService.remove).toHaveBeenCalledWith(
        { id: mockUser.id, role: mockUser.role },
        1,
      );
      expect(result).toEqual({ ok: true });
    });
  });
});

