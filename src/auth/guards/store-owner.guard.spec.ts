import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StoreOwnerGuard } from './store-owner.guard';
import { OwnershipService } from '../../common/services/ownership.service';

describe('StoreOwnerGuard', () => {
  let guard: StoreOwnerGuard;
  let ownershipService: jest.Mocked<OwnershipService>;

  beforeEach(async () => {
    const mockOwnershipService = {
      isStoreOwner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreOwnerGuard,
        { provide: OwnershipService, useValue: mockOwnershipService },
      ],
    }).compile();

    guard = module.get<StoreOwnerGuard>(StoreOwnerGuard);
    ownershipService = module.get(OwnershipService);

    jest.clearAllMocks();
  });

  const createMockContext = (user: any, params: any) => {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
          params,
        }),
      }),
    } as any;
  };

  describe('canActivate', () => {
    it('should return true if user is admin', async () => {
      const context = createMockContext(
        { id: 1, email: 'admin@example.com', role: 'ADMIN' },
        { id: '1' },
      );

      const result = await guard.canActivate(context);

      expect(ownershipService.isStoreOwner).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true if user owns the store', async () => {
      ownershipService.isStoreOwner.mockResolvedValue(true);
      const context = createMockContext(
        { id: 1, email: 'owner@example.com', role: 'STORE_OWNER' },
        { id: '1' },
      );

      const result = await guard.canActivate(context);

      expect(ownershipService.isStoreOwner).toHaveBeenCalledWith(1, 1);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user does not own the store', async () => {
      ownershipService.isStoreOwner.mockResolvedValue(false);
      const context = createMockContext(
        { id: 1, email: 'user@example.com', role: 'USER' },
        { id: '1' },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is not authenticated', async () => {
      const context = createMockContext(undefined, { id: '1' });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if store id is missing', async () => {
      const context = createMockContext(
        { id: 1, email: 'user@example.com', role: 'STORE_OWNER' },
        {},
      );

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    });
  });
});

