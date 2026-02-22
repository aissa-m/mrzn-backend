import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { AdminBootstrapService } from '../admin-bootstrap.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BootstrapAdminDto } from '../dto/bootstrap-admin.dto';

describe('AdminBootstrapService', () => {
  let service: AdminBootstrapService;
  let prisma: jest.Mocked<Pick<PrismaService, 'user'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'sign'>>;

  const dto: BootstrapAdminDto = {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
  };

  const createdUser = {
    id: 1,
    name: dto.name,
    email: dto.email,
    password: 'hashed',
    role: Role.ADMIN,
    phone: null,
    createdAt: new Date(),
    stores: [],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as any;
    jwt = { sign: jest.fn().mockReturnValue('access_token_value') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBootstrapService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    service = module.get(AdminBootstrapService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 99 } as any);
    await expect(service.bootstrap(dto)).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('should create admin and return access_token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(createdUser as any);

    const result = await service.bootstrap(dto);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: dto.name,
        email: dto.email,
        role: Role.ADMIN,
      }),
      include: { stores: true },
    });
    expect(result.access_token).toBe('access_token_value');
    expect(result.user.id).toBe(1);
    expect(result.user.email).toBe(dto.email);
    expect(result.user.role).toBe(Role.ADMIN);
  });
});
