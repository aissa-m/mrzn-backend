import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { JwtUserPayload } from '../auth/types';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: jest.Mocked<NotificationsService>;

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
    const mockNotificationsService = {
      list: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsService }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get(NotificationsService);

    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return notifications for user', async () => {
      notificationsService.list.mockResolvedValue([mockNotification]);

      const result = await controller.list(mockUser);

      expect(notificationsService.list).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual([mockNotification]);
    });
  });

  describe('markOne', () => {
    it('should mark a notification as read', async () => {
      notificationsService.markRead.mockResolvedValue({ count: 1 });

      const result = await controller.markOne(mockUser, 1);

      expect(notificationsService.markRead).toHaveBeenCalledWith(mockUser, 1);
      expect(result.count).toBe(1);
    });
  });

  describe('markAll', () => {
    it('should mark all notifications as read', async () => {
      notificationsService.markAllRead.mockResolvedValue({ count: 5 });

      const result = await controller.markAll(mockUser);

      expect(notificationsService.markAllRead).toHaveBeenCalledWith(mockUser);
      expect(result.count).toBe(5);
    });
  });
});

