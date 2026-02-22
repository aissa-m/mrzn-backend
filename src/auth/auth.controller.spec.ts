import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { RegisterDto, LoginDto, OtpRequestDto, OtpVerifyDto } from './dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let otpService: jest.Mocked<OtpService>;

  const mockAuthResult = {
    access_token: 'mock-token',
    user: {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'USER',
      stores: [],
    },
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      signOtpUser: jest.fn(),
    };
    const mockOtpService = {
      requestOtp: jest.fn(),
      verifyOtp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: OtpService, useValue: mockOtpService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    otpService = module.get(OtpService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register with correct DTO', async () => {
      const registerDto: RegisterDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      authService.register.mockResolvedValue(mockAuthResult);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResult);
    });
  });

  describe('login', () => {
    it('should call authService.login with correct DTO', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      authService.login.mockResolvedValue(mockAuthResult);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResult);
    });
  });

  describe('POST /auth/otp/request', () => {
    it('should call otpService.requestOtp and return success', async () => {
      const dto: OtpRequestDto = {
        phone: '+34600000000',
        desiredRole: 'USER',
      };
      otpService.requestOtp.mockResolvedValue({ success: true });

      const result = await controller.otpRequest(dto);

      expect(otpService.requestOtp).toHaveBeenCalledWith(
        dto.phone.trim(),
        dto.desiredRole,
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('POST /auth/otp/verify', () => {
    it('should verify OTP and return accessToken and user', async () => {
      const dto: OtpVerifyDto = {
        phone: '+34600000000',
        code: '123456',
        desiredRole: 'USER',
      };
      const mockUser = {
        id: 1,
        name: null,
        email: null,
        role: 'USER',
        phone: '+34600000000',
        stores: [],
      };
      otpService.verifyOtp.mockResolvedValue(mockUser);
      authService.signOtpUser.mockReturnValue({
        accessToken: 'jwt-token',
        user: { ...mockUser, name: undefined, email: undefined },
      });

      const result = await controller.otpVerify(dto);

      expect(otpService.verifyOtp).toHaveBeenCalledWith(
        dto.phone.trim(),
        dto.code,
        dto.desiredRole,
      );
      expect(authService.signOtpUser).toHaveBeenCalledWith(mockUser);
      expect(result).toHaveProperty('accessToken', 'jwt-token');
      expect(result).toHaveProperty('user');
    });
  });
});
