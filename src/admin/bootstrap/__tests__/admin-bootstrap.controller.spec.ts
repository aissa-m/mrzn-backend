import { Test, TestingModule } from '@nestjs/testing';
import { AdminBootstrapController } from '../admin-bootstrap.controller';
import { AdminBootstrapService } from '../admin-bootstrap.service';
import { AdminBootstrapGuard } from '../admin-bootstrap.guard';
import { BootstrapAdminDto } from '../dto/bootstrap-admin.dto';

describe('AdminBootstrapController', () => {
  let controller: AdminBootstrapController;
  let service: jest.Mocked<AdminBootstrapService>;

  const dto: BootstrapAdminDto = {
    name: 'Admin',
    email: 'admin@example.com',
    password: 'password123',
  };

  const mockResponse = {
    access_token: 'token',
    user: { id: 1, email: dto.email, role: 'ADMIN' },
  };

  const mockGuard = { canActivate: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const mockService = {
      bootstrap: jest.fn().mockResolvedValue(mockResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBootstrapController],
      providers: [{ provide: AdminBootstrapService, useValue: mockService }],
    })
      .overrideGuard(AdminBootstrapGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get(AdminBootstrapController);
    service = module.get(AdminBootstrapService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.bootstrap with body', async () => {
    const result = await controller.bootstrap(dto);
    expect(service.bootstrap).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
