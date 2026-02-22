import { ExecutionContext, ForbiddenException, ConflictException } from '@nestjs/common';
import { AdminBootstrapGuard } from '../admin-bootstrap.guard';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AdminBootstrapGuard', () => {
  let guard: AdminBootstrapGuard;
  let prisma: jest.Mocked<Pick<PrismaService, 'user'>>;

  const mockContext = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
    } as any;
    guard = new AdminBootstrapGuard(prisma as PrismaService);
  });

  it('should throw 403 when ADMIN_BOOTSTRAP_SECRET is not set', async () => {
    const orig = process.env.ADMIN_BOOTSTRAP_SECRET;
    delete process.env.ADMIN_BOOTSTRAP_SECRET;
    const ctx = mockContext({ 'x-admin-bootstrap-secret': 'secret' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    process.env.ADMIN_BOOTSTRAP_SECRET = orig;
  });

  it('should throw 403 when header secret is missing', async () => {
    process.env.ADMIN_BOOTSTRAP_SECRET = 'expected-secret';
    const ctx = mockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw 403 when header secret does not match', async () => {
    process.env.ADMIN_BOOTSTRAP_SECRET = 'expected-secret';
    const ctx = mockContext({ 'x-admin-bootstrap-secret': 'wrong' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw 409 when an admin already exists', async () => {
    process.env.ADMIN_BOOTSTRAP_SECRET = 'expected-secret';
    prisma.user.findFirst.mockResolvedValue({ id: 1 });
    const ctx = mockContext({ 'x-admin-bootstrap-secret': 'expected-secret' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ConflictException);
  });

  it('should allow when secret matches and no admin exists', async () => {
    process.env.ADMIN_BOOTSTRAP_SECRET = 'expected-secret';
    prisma.user.findFirst.mockResolvedValue(null);
    const ctx = mockContext({ 'x-admin-bootstrap-secret': 'expected-secret' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
