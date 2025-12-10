import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'USER',
    avatarUrl: null,
    createdAt: new Date(),
    stores: [],
  };

  const mockCurrentUser = { id: 1, email: 'test@example.com', role: 'USER' };

  beforeEach(async () => {
    const mockUsersService = {
      getMe: jest.fn(),
      updateAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);

    jest.clearAllMocks();
  });

  describe('me', () => {
    it('should return current user data', async () => {
      usersService.getMe.mockResolvedValue(mockUser);

      const result = await controller.me(mockCurrentUser);

      expect(usersService.getMe).toHaveBeenCalledWith(mockCurrentUser.id);
      expect(result).toEqual(mockUser);
    });
  });

  describe('uploadAvatar', () => {
    it('should update user avatar from uploaded file', async () => {
      const mockFile = {
        filename: '1-1234567890.jpg',
      } as Express.Multer.File;
      const mockReq = { user: mockCurrentUser };
      const updatedUser = { ...mockUser, avatarUrl: '/uploads/avatars/1-1234567890.jpg' };
      usersService.updateAvatar.mockResolvedValue(updatedUser);

      const result = await controller.uploadAvatar(mockFile, mockReq);

      expect(usersService.updateAvatar).toHaveBeenCalledWith(
        mockCurrentUser.id,
        '/uploads/avatars/1-1234567890.jpg',
      );
      expect(result).toEqual(updatedUser);
    });
  });
});

