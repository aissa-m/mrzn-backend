import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatGateway } from './chat.gateway';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtUserPayload } from '../auth/types';

describe('ChatService', () => {
  let service: ChatService;
  let prismaService: jest.Mocked<PrismaService>;
  let notificationsService: jest.Mocked<NotificationsService>;
  let chatGateway: jest.Mocked<ChatGateway>;

  const mockUser: JwtUserPayload = {
    id: 1,
    email: 'test@example.com',
    role: 'USER',
  };

  const mockConversation = {
    id: 1,
    storeId: 1,
    productId: null,
    orderId: null,
    createdAt: new Date(),
    participants: [
      { userId: 1, role: 'BUYER' },
      { userId: 2, role: 'SELLER' },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      conversation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      conversationParticipant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      messageAttachment: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockNotificationsService = {
      create: jest.fn(),
    };

    const mockChatGateway = {
      emitNewMessage: jest.fn(),
      isUserOnline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prismaService = module.get(PrismaService);
    notificationsService = module.get(NotificationsService);
    chatGateway = module.get(ChatGateway);

    jest.clearAllMocks();
  });

  describe('openConversation', () => {
    const createDto: CreateConversationDto = {
      otherUserId: 2,
      storeId: 1,
    };

    it('should throw BadRequestException if user tries to chat with themselves', async () => {
      await expect(
        service.openConversation(mockUser, { ...createDto, otherUserId: mockUser.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing conversation if it exists', async () => {
      prismaService.conversation.findFirst.mockResolvedValue(mockConversation as any);

      const result = await service.openConversation(mockUser, createDto);

      expect(prismaService.conversation.findFirst).toHaveBeenCalled();
      expect(result).toEqual(mockConversation);
      expect(prismaService.conversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if it does not exist', async () => {
      prismaService.conversation.findFirst.mockResolvedValue(null);
      prismaService.conversation.create.mockResolvedValue(mockConversation as any);

      const result = await service.openConversation(mockUser, createDto);

      expect(prismaService.conversation.create).toHaveBeenCalled();
      expect(result).toEqual(mockConversation);
    });
  });

  describe('getMessages', () => {
    const cursorDto = { cursor: undefined, limit: 30 };

    it('should throw ForbiddenException if user is not a participant', async () => {
      prismaService.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(service.getMessages(mockUser, 1, cursorDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return messages for valid participant', async () => {
      prismaService.conversationParticipant.findUnique.mockResolvedValue({
        userId: 1,
        conversationId: 1,
      } as any);
      prismaService.message.findMany.mockResolvedValue([]);

      const result = await service.getMessages(mockUser, 1, cursorDto);

      expect(prismaService.message.findMany).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('nextCursor');
    });
  });

  describe('sendText', () => {
    const sendDto: SendMessageDto = {
      conversationId: 1,
      content: 'Test message',
    };

    const mockMessage = {
      id: 1,
      conversationId: 1,
      senderId: 1,
      content: 'Test message',
      type: 'TEXT',
      createdAt: new Date(),
      sender: { id: 1, name: 'Test User' },
      attachments: [],
    };

    it('should throw ForbiddenException if user is not a participant', async () => {
      prismaService.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(service.sendText(mockUser, sendDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should send message successfully', async () => {
      prismaService.conversationParticipant.findUnique.mockResolvedValue({
        userId: 1,
        conversationId: 1,
      } as any);
      prismaService.message.create.mockResolvedValue(mockMessage as any);
      prismaService.conversation.update.mockResolvedValue(mockConversation as any);
      prismaService.conversationParticipant.findMany.mockResolvedValue([
        { userId: 2 },
      ] as any);
      chatGateway.isUserOnline.mockReturnValue(false);

      const result = await service.sendText(mockUser, sendDto);

      expect(prismaService.message.create).toHaveBeenCalled();
      expect(chatGateway.emitNewMessage).toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });
  });
});

