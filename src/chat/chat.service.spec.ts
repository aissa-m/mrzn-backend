import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
      product: {
        findUnique: jest.fn(),
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

    it('should throw BadRequestException when no productId and no otherUserId', async () => {
      await expect(
        service.openConversation(mockUser, { storeId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing conversation if it exists (legacy)', async () => {
      prismaService.conversation.findFirst.mockResolvedValue(mockConversation as any);

      const result = await service.openConversation(mockUser, createDto);

      expect(prismaService.conversation.findFirst).toHaveBeenCalled();
      expect(result).toEqual(mockConversation);
      expect(prismaService.conversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if it does not exist (legacy)', async () => {
      prismaService.conversation.findFirst.mockResolvedValue(null);
      prismaService.conversation.create.mockResolvedValue(mockConversation as any);

      const result = await service.openConversation(mockUser, createDto);

      expect(prismaService.conversation.create).toHaveBeenCalled();
      expect(result).toEqual(mockConversation);
    });

    it('should open by productId: seller = Product.userId, storeId from product', async () => {
      const product = { id: 10, userId: 2, storeId: 1 };
      prismaService.product.findUnique.mockResolvedValue(product as any);
      prismaService.conversation.findFirst.mockResolvedValue(null);
      const convoWithProduct = { ...mockConversation, productId: 10, storeId: 1 };
      prismaService.conversation.create.mockResolvedValue(convoWithProduct as any);

      const result = await service.openConversation(mockUser, {
        productId: 10,
        otherUserId: 2,
      });

      expect(prismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { id: true, userId: true, storeId: true },
      });
      expect(prismaService.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 10,
            storeId: 1,
            participants: {
              create: [
                expect.objectContaining({ userId: 1, role: 'BUYER' }),
                expect.objectContaining({ userId: 2, role: 'SELLER' }),
              ],
            },
          }),
        }),
      );
      expect(result).toEqual(convoWithProduct);
    });

    it('should open by productId when product has no store (storeId null)', async () => {
      const product = { id: 20, userId: 2, storeId: null };
      prismaService.product.findUnique.mockResolvedValue(product as any);
      prismaService.conversation.findFirst.mockResolvedValue(null);
      const convoNoStore = { ...mockConversation, productId: 20, storeId: null };
      prismaService.conversation.create.mockResolvedValue(convoNoStore as any);

      const result = await service.openConversation(mockUser, { productId: 20 });

      expect(prismaService.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: 20,
            storeId: undefined,
            participants: {
              create: [
                expect.objectContaining({ userId: 1, role: 'BUYER' }),
                expect.objectContaining({ userId: 2, role: 'SELLER' }),
              ],
            },
          }),
        }),
      );
      expect(result).toEqual(convoNoStore);
    });

    it('should return existing conversation for same buyer + seller + productId (no duplicate)', async () => {
      const product = { id: 30, userId: 2, storeId: null };
      prismaService.product.findUnique.mockResolvedValue(product as any);
      const existingConvo = { id: 5, productId: 30, storeId: null, participants: [] };
      prismaService.conversation.findFirst.mockResolvedValue(existingConvo as any);

      const result = await service.openConversation(mockUser, { productId: 30, otherUserId: 2 });

      expect(result).toEqual(existingConvo);
      expect(prismaService.conversation.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when productId does not exist', async () => {
      prismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.openConversation(mockUser, { productId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when productId sent but otherUserId does not match Product.userId', async () => {
      prismaService.product.findUnique.mockResolvedValue({ id: 10, userId: 2, storeId: 1 } as any);

      await expect(
        service.openConversation(mockUser, { productId: 10, otherUserId: 99 }),
      ).rejects.toThrow(BadRequestException);
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

