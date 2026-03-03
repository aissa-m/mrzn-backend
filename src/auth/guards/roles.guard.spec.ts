import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtUserPayload } from '../types';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  const createMockContext = (user?: JwtUserPayload) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as any;
  };

  describe('canActivate', () => {
    it('should return true if no roles are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext({ id: 1, email: 'test@example.com', role: 'USER' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return true if user role matches required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'STORE_OWNER']);
      const context = createMockContext({
        id: 1,
        email: 'test@example.com',
        role: 'ADMIN',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should return false if user role does not match required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
      const context = createMockContext({
        id: 1,
        email: 'test@example.com',
        role: 'USER',
      });

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('should return false if user is not authenticated', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
      const context = createMockContext(undefined);

      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });
  });
});
