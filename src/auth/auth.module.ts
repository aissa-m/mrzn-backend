//src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { OtpService } from './otp/otp.service';
import { SmsModule } from '../sms/sms.module';
import { OTP_PROVIDER } from './otp/interfaces/otp-provider.interface';
import { LocalOtpProvider } from './otp/providers/local-otp.provider';
import { TwilioOtpProvider } from './otp/providers/twilio-otp.provider';

const TWILIO_ENV_KEYS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID',
] as const;

function ensureTwilioConfigForProduction(): void {
  const missing = TWILIO_ENV_KEYS.filter(
    (key) => (process.env[key] ?? '').trim() === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `In production OTP uses Twilio. Missing required env: ${missing.join(', ')}. Set them and restart.`,
    );
  }
}

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
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    OptionalJwtAuthGuard,
    LocalOtpProvider,
    TwilioOtpProvider,
    {
      provide: OTP_PROVIDER,
      useFactory: (local: LocalOtpProvider, twilio: TwilioOtpProvider) => {
        if (process.env.NODE_ENV === 'production') {
          ensureTwilioConfigForProduction();
          return twilio;
        }
        return local;
      },
      inject: [LocalOtpProvider, TwilioOtpProvider],
    },
  ],
  exports: [JwtModule, OptionalJwtAuthGuard],
})
export class AuthModule {}
