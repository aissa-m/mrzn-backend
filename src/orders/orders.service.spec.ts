import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/services/ownership.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStatus, Role } from '@prisma/client';
import { Prisma } from '@prisma/client';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: jest.Mocked<PrismaService>;
  let ownershipService: jest.Mocked<OwnershipService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  const mockOrder = {
    id: 1,
    userId: 1,
    storeId: 1,
    total: 20.0,
    status: OrderStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    user: { id: 1, email: 'user@example.com' },
    store: { id: 1, name: 'Test Store', ownerId: 1 },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      product: {
        findMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockOwnershipService = {
      isStoreOwner: jest.fn(),
    };

    const mockNotificationsService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OwnershipService, useValue: mockOwnershipService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get(PrismaService);
    ownershipService = module.get(OwnershipService);
    notificationsService = module.get(NotificationsService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateOrderDto = {
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    };

    it('should create an order successfully', async () => {
      const mockProducts = [
        { id: 1, price: new Prisma.Decimal('10.0'), storeId: 1 },
        { id: 2, price: new Prisma.Decimal('5.0'), storeId: 1 },
      ];

      prismaService.product.findMany.mockResolvedValue(mockProducts);
      prismaService.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          order: {
            create: jest.fn().mockResolvedValue({ id: 1, ...mockOrder }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(tx);
      });

      const result = await service.create(1, createDto);

      expect(prismaService.product.findMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if items array is empty', async () => {
      await expect(service.create(1, { items: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if product does not exist', async () => {
      prismaService.product.findMany.mockResolvedValue([
        { id: 1, price: new Prisma.Decimal('10.0'), storeId: 1 },
      ]);

      await expect(service.create(1, createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if products are from different stores', async () => {
      const mockProducts = [
        { id: 1, price: new Prisma.Decimal('10.0'), storeId: 1 },
        { id: 2, price: new Prisma.Decimal('5.0'), storeId: 2 },
      ];
      prismaService.product.findMany.mockResolvedValue(mockProducts);

      await expect(service.create(1, createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByUser', () => {
    it('should return orders for a user', async () => {
      prismaService.order.findMany.mockResolvedValue([mockOrder]);

      const result = await service.findByUser(1);

      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: { items: true, store: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findByStore', () => {
    it('should return orders for a store if user is admin', async () => {
      const user = { id: 1, role: Role.ADMIN };
      prismaService.order.findMany.mockResolvedValue([mockOrder]);

      const result = await service.findByStore(1, user);

      expect(ownershipService.isStoreOwner).not.toHaveBeenCalled();
      expect(result).toEqual([mockOrder]);
    });

    it('should return orders if user is store owner', async () => {
      const user = { id: 1, role: Role.STORE_OWNER };
      ownershipService.isStoreOwner.mockResolvedValue(true);
      prismaService.order.findMany.mockResolvedValue([mockOrder]);

      const result = await service.findByStore(1, user);

      expect(ownershipService.isStoreOwner).toHaveBeenCalled();
      expect(result).toEqual([mockOrder]);
    });

    it('should throw ForbiddenException if user is not owner or admin', async () => {
      const user = { id: 2, role: Role.USER };
      ownershipService.isStoreOwner.mockResolvedValue(false);

      await expect(service.findByStore(1, user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOneAccessible', () => {
    it('should return order if user is buyer', async () => {
      const user = { id: 1, role: Role.USER };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOneAccessible(1, user);

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      prismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.findOneAccessible(999, { id: 1, role: Role.USER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      prismaService.order.findUnique.mockResolvedValue(mockOrder);
      ownershipService.isStoreOwner.mockResolvedValue(false);

      await expect(
        service.findOneAccessible(1, { id: 999, role: Role.USER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('should update order status successfully', async () => {
      const user = { id: 1, role: Role.STORE_OWNER };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);
      ownershipService.isStoreOwner.mockResolvedValue(true);
      prismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });
      notificationsService.create.mockResolvedValue({} as any);

      const result = await service.updateStatus(1, OrderStatus.PAID, user);

      expect(prismaService.order.update).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(OrderStatus.PAID);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const user = { id: 1, role: Role.STORE_OWNER };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);
      ownershipService.isStoreOwner.mockResolvedValue(true);

      await expect(
        service.updateStatus(1, OrderStatus.COMPLETED, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user cannot modify status', async () => {
      const user = { id: 2, role: Role.USER };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);
      ownershipService.isStoreOwner.mockResolvedValue(false);

      await expect(
        service.updateStatus(1, OrderStatus.PAID, user),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('should cancel order if user is buyer and status is PENDING', async () => {
      const user = { id: 1, role: Role.USER };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);
      prismaService.order.update.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELED,
      });

      const result = await service.cancel(1, user);

      expect(result.status).toBe(OrderStatus.CANCELED);
    });

    it('should throw BadRequestException if buyer tries to cancel non-PENDING order', async () => {
      const user = { id: 1, role: Role.USER };
      prismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      await expect(service.cancel(1, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findMany', () => {
    it('should return paginated orders for USER', async () => {
      const user = { id: 1, role: 'USER' };
      const queryDto: QueryOrdersDto = { page: 1, pageSize: 10 };
      prismaService.$transaction.mockResolvedValue([[mockOrder], 1]);

      const result = await service.findMany(user, queryDto);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
    });
  });

  describe('findOne', () => {
    it('should return order if user has access', async () => {
      const user = { id: 1, role: 'USER' };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne(user, 1);

      expect(result).toEqual(mockOrder);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      const user = { id: 999, role: 'USER' };
      prismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.findOne(user, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});

