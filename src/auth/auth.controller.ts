import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { RegisterDto, LoginDto, OtpRequestDto, OtpVerifyDto } from './dto';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('otp/request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 req/min por IP
  async otpRequest(@Body() dto: OtpRequestDto) {
    const phone = dto.phone.trim();
    return this.otp.requestOtp(phone, dto.desiredRole);
  }

  @Post('otp/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async otpVerify(@Body() dto: OtpVerifyDto) {
    const user = await this.otp.verifyOtp(
      dto.phone.trim(),
      dto.code,
      dto.desiredRole,
    );
    return this.auth.signOtpUser(user);
  }
}
