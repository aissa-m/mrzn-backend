import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus, Role } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: jest.Mocked<OrdersService>;

  const mockOrder = {
    id: 1,
    userId: 1,
    storeId: 1,
    total: 20.0,
    status: OrderStatus.PENDING,
    items: [],
  };

  const mockUser = { id: 1, email: 'test@example.com', role: 'USER' };

  beforeEach(async () => {
    const mockOrdersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByUser: jest.fn(),
      findByStore: jest.fn(),
      findOneAccessible: jest.fn(),
      updateStatus: jest.fn(),
      cancel: jest.fn(),
      remove: jest.fn(),
      findMany: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get(OrdersService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an order', async () => {
      const createDto: CreateOrderDto = {
        items: [{ productId: 1, quantity: 2 }],
      };
      ordersService.create.mockResolvedValue(mockOrder as any);

      const result = await controller.create(mockUser, createDto);

      expect(ordersService.create).toHaveBeenCalledWith(mockUser.id, createDto);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('findMine', () => {
    it('should return orders for current user', async () => {
      ordersService.findByUser.mockResolvedValue([mockOrder] as any);

      const result = await controller.findMine(mockUser);

      expect(ordersService.findByUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return an order by id', async () => {
      ordersService.findOneAccessible.mockResolvedValue(mockOrder as any);

      const result = await controller.findOne(1, mockUser);

      expect(ordersService.findOneAccessible).toHaveBeenCalledWith(1, mockUser);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      ordersService.updateStatus.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      } as any);

      const result = await controller.updateStatus(1, { status: OrderStatus.PAID }, mockUser);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PAID, mockUser);
      expect(result.status).toBe(OrderStatus.PAID);
    });
  });

  describe('cancel', () => {
    it('should cancel an order', async () => {
      ordersService.cancel.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELED,
      } as any);

      const result = await controller.cancel(1, mockUser);

      expect(ordersService.cancel).toHaveBeenCalledWith(1, mockUser);
      expect(result.status).toBe(OrderStatus.CANCELED);
    });
  });

  describe('findMany', () => {
    it('should return paginated orders', async () => {
      const queryDto: QueryOrdersDto = { page: 1, pageSize: 10 };
      const mockResult = {
        data: [mockOrder],
        pagination: { page: 1, pageSize: 10, total: 1, pages: 1 },
      };
      ordersService.findMany.mockResolvedValue(mockResult as any);

      const result = await controller.findMany(mockUser, queryDto);

      expect(ordersService.findMany).toHaveBeenCalledWith(mockUser, queryDto);
      expect(result).toEqual(mockResult);
    });
  });
});

