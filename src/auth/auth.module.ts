//src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    PassportModule,
    SmsModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: Number(process.env.JWT_EXPIRES_IN) || 60 * 60 * 24 * 7,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
