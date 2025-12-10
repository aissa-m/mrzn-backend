import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: jest.Mocked<ProductsService>;

  const mockProduct = {
    id: 1,
    name: 'Test Product',
    description: 'Test Description',
    price: 10.5,
    storeId: 1,
    images: [],
  };

  const mockUser = { id: 1, email: 'test@example.com', role: 'STORE_OWNER' };

  beforeEach(async () => {
    const mockProductsService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAllByStore: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findManyWithQuery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get(ProductsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createDto: CreateProductDto = {
        name: 'Test Product',
        price: 10.5,
        storeId: 1,
      };
      const files = [] as Express.Multer.File[];
      productsService.create.mockResolvedValue(mockProduct as any);

      const result = await controller.create(mockUser, createDto, files);

      expect(productsService.create).toHaveBeenCalledWith(
        mockUser.id,
        createDto,
        files,
      );
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      productsService.findOne.mockResolvedValue(mockProduct as any);

      const result = await controller.findOne('1');

      expect(productsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProduct);
    });
  });


  describe('update', () => {
    it('should update a product', async () => {
      const updateDto: UpdateProductDto = { name: 'Updated Product' };
      productsService.update.mockResolvedValue({ ...mockProduct, name: 'Updated Product' } as any);

      const result = await controller.update(mockUser, '1', updateDto, []);

      expect(productsService.update).toHaveBeenCalledWith(
        mockUser.id,
        1,
        updateDto,
        [],
      );
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete a product', async () => {
      productsService.remove.mockResolvedValue({ ok: true });

      const result = await controller.remove(mockUser, '1');

      expect(productsService.remove).toHaveBeenCalledWith(mockUser.id, 1);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('list', () => {
    it('should return paginated products', async () => {
      const queryDto = { page: 1, limit: 10 };
      const mockResult = { items: [mockProduct], meta: { total: 1, page: 1, limit: 10 } };
      productsService.findManyWithQuery.mockResolvedValue(mockResult as any);

      const result = await controller.list(queryDto);

      expect(productsService.findManyWithQuery).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(mockResult);
    });
  });
});

