import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ProductOwnerGuard } from './product-owner.guard';
import { OwnershipService } from '../../common/services/ownership.service';

describe('ProductOwnerGuard', () => {
  let guard: ProductOwnerGuard;
  let ownershipService: jest.Mocked<OwnershipService>;

  beforeEach(async () => {
    const mockOwnershipService = {
      isProductOwner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductOwnerGuard,
        { provide: OwnershipService, useValue: mockOwnershipService },
      ],
    }).compile();

    guard = module.get<ProductOwnerGuard>(ProductOwnerGuard);
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

      expect(ownershipService.isProductOwner).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return true if user owns the product', async () => {
      ownershipService.isProductOwner.mockResolvedValue(true);
      const context = createMockContext(
        { id: 1, email: 'owner@example.com', role: 'STORE_OWNER' },
        { id: '1' },
      );

      const result = await guard.canActivate(context);

      expect(ownershipService.isProductOwner).toHaveBeenCalledWith(1, 1);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user does not own the product', async () => {
      ownershipService.isProductOwner.mockResolvedValue(false);
      const context = createMockContext(
        { id: 1, email: 'user@example.com', role: 'USER' },
        { id: '1' },
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('You are not the owner of this product'),
      );
    });

    it('should throw BadRequestException if product id is missing', async () => {
      const context = createMockContext(
        { id: 1, email: 'user@example.com', role: 'USER' },
        {},
      );

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user is not authenticated', async () => {
      const context = createMockContext(undefined, { id: '1' });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});

