import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SMS_SERVICE } from '../../../sms/sms.interface';
import type { ISmsService } from '../../../sms/sms.interface';
import type { IOtpProvider } from '../interfaces/otp-provider.interface';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_REQUESTS_PER_PHONE = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 min

/** Bypass solo en desarrollo; en producción NODE_ENV === 'production' no se usa */
export const DEV_OTP_BYPASS = '000000';

function generateNumericOtp(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

@Injectable()
export class LocalOtpProvider implements IOtpProvider {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_SERVICE) private readonly sms: ISmsService,
  ) {}

  async requestOtp(phone: string): Promise<{ success: boolean; devOtp?: string }> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await this.prisma.otpCode.count({
      where: {
        phone,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= RATE_LIMIT_REQUESTS_PER_PHONE) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMIT',
        message: 'Too many OTP requests for this phone. Try again later.',
      });
    }

    await this.prisma.otpCode.updateMany({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    const code = generateNumericOtp(OTP_LENGTH);
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.otpCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
        purpose: 'login',
      },
    });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[OTP Dev] phone=${phone} code=${code} (do not use in prod)`);
    } else {
      await this.sms.sendOtp(phone, code);
    }

    const res: { success: boolean; devOtp?: string } = { success: true };
    if (isDev) res.devOtp = code;
    return res;
  }

  async verifyCode(phone: string, code: string): Promise<void> {
    const isDev = process.env.NODE_ENV !== 'production';

    const record = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP expired or already used.',
      });
    }

    const valid =
      isDev && code === DEV_OTP_BYPASS
        ? true
        : await bcrypt.compare(code, record.codeHash);

    if (!valid) {
      const newAttempts = record.attempts + 1;
      await this.prisma.otpCode.update({
        where: { id: record.id },
        data: { attempts: newAttempts },
      });
      if (newAttempts >= MAX_ATTEMPTS) {
        await this.prisma.otpCode.update({
          where: { id: record.id },
          data: { consumedAt: new Date() },
        });
        throw new BadRequestException({
          code: 'OTP_TOO_MANY_ATTEMPTS',
          message: 'Too many failed attempts. Request a new code.',
        });
      }
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Invalid OTP code.',
      });
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }
}
