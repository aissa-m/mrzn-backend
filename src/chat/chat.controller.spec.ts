import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtUserPayload } from '../auth/types';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;

  const mockUser: JwtUserPayload = {
    id: 1,
    email: 'test@example.com',
    role: 'USER',
  };

  const mockConversation = {
    id: 1,
    storeId: 1,
    participants: [],
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockChatService = {
      openConversation: jest.fn(),
      listConversations: jest.fn(),
      getMessages: jest.fn(),
      sendText: jest.fn(),
      markAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);

    jest.clearAllMocks();
  });

  describe('open', () => {
    it('should open/create a conversation', async () => {
      const createDto: CreateConversationDto = {
        otherUserId: 2,
        storeId: 1,
      };
      chatService.openConversation.mockResolvedValue(mockConversation as any);

      const result = await controller.open(mockUser, createDto);

      expect(chatService.openConversation).toHaveBeenCalledWith(mockUser, createDto);
      expect(result).toEqual(mockConversation);
    });
  });

  describe('list', () => {
    it('should return list of conversations', async () => {
      const mockResult = {
        data: [mockConversation],
        pagination: { page: 1, pageSize: 20, total: 1, pages: 1 },
      };
      chatService.listConversations.mockResolvedValue(mockResult as any);

      const result = await controller.list(mockUser, { page: 1, pageSize: 20 });

      expect(chatService.listConversations).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('messages', () => {
    it('should return messages for a conversation', async () => {
      const mockMessages = {
        data: [],
        nextCursor: null,
      };
      chatService.getMessages.mockResolvedValue(mockMessages as any);

      const result = await controller.messages(mockUser, 1, {});

      expect(chatService.getMessages).toHaveBeenCalledWith(mockUser, 1, {});
      expect(result).toEqual(mockMessages);
    });
  });

  describe('sendText', () => {
    it('should send a text message', async () => {
      const sendDto: SendMessageDto = {
        conversationId: 1,
        content: 'Hello',
      };
      const mockMessage = {
        id: 1,
        content: 'Hello',
        conversationId: 1,
        senderId: 1,
      };
      chatService.sendText.mockResolvedValue(mockMessage as any);

      const result = await controller.sendText(mockUser, sendDto);

      expect(chatService.sendText).toHaveBeenCalledWith(mockUser, sendDto);
      expect(result).toEqual(mockMessage);
    });
  });
});

