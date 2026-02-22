import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { JwtUserPayload } from '../auth/types';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: jest.Mocked<PrismaService>;
  let gateway: jest.Mocked<NotificationsGateway>;

  const mockNotification = {
    id: 1,
    userId: 1,
    type: 'ORDER_UPDATE',
    title: 'Test Notification',
    body: 'Test Body',
    read: false,
    createdAt: new Date(),
  };

  const mockUser: JwtUserPayload = {
    id: 1,
    email: 'test@example.com',
    role: 'USER',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const mockGateway = {
      emitToUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get(PrismaService);
    gateway = module.get(NotificationsGateway);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification and emit to user', async () => {
      prismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create(1, 'ORDER_UPDATE', 'Title', 'Body');

      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: { userId: 1, type: 'ORDER_UPDATE', title: 'Title', body: 'Body' },
      });
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        1,
        'notification:new',
        mockNotification,
      );
      expect(result).toEqual(mockNotification);
    });
  });

  describe('list', () => {
    it('should return notifications for user', async () => {
      prismaService.notification.findMany.mockResolvedValue([mockNotification]);

      const result = await service.list(mockUser);

      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual([mockNotification]);
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markRead(mockUser, 1);

      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 1, userId: mockUser.id },
        data: { read: true },
      });
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        mockUser.id,
        'notification:read',
        { id: 1 },
      );
      expect(result.count).toBe(1);
    });

    it('should not emit if no notifications were updated', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 0 });

      await service.markRead(mockUser, 1);

      expect(gateway.emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', async () => {
      prismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllRead(mockUser);

      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, read: false },
        data: { read: true },
      });
      expect(gateway.emitToUser).toHaveBeenCalledWith(
        mockUser.id,
        'notification:readAll',
        {},
      );
      expect(result.count).toBe(5);
    });
  });
});

