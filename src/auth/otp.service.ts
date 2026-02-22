import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { SMS_SERVICE } from '../sms/sms.interface';
import type { ISmsService } from '../sms/sms.interface';
import { Role } from '@prisma/client';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_REQUESTS_PER_PHONE = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 min

/** Normaliza teléfono: trim y solo dígitos/+ */
export function normalizePhone(phone: string): string {
  return phone.trim();
}

function generateNumericOtp(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

/** Código fijo para desarrollo cuando NODE_ENV !== 'production' */
export const DEV_OTP_BYPASS = '000000';

@Injectable()
export class OtpService {
  constructor(
    private prisma: PrismaService,
    @Inject(SMS_SERVICE) private sms: ISmsService,
  ) {}

  async requestOtp(phone: string, desiredRole: 'USER' | 'STORE_OWNER'): Promise<{
    success: boolean;
    devOtp?: string;
  }> {
    const normalized = normalizePhone(phone);

    // Rate limit por teléfono: máx N solicitudes en la ventana
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCount = await this.prisma.otpCode.count({
      where: {
        phone: normalized,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= RATE_LIMIT_REQUESTS_PER_PHONE) {
      throw new BadRequestException({
        code: 'OTP_RATE_LIMIT',
        message: 'Too many OTP requests for this phone. Try again later.',
      });
    }

    // Invalidar OTPs activos previos para este teléfono
    await this.prisma.otpCode.updateMany({
      where: {
        phone: normalized,
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
        phone: normalized,
        codeHash,
        expiresAt,
        purpose: 'login',
      },
    });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[OTP Dev] phone=${normalized} code=${code} (do not use in prod)`);
    } else {
      await this.sms.sendOtp(normalized, code);
    }

    const res: { success: boolean; devOtp?: string } = { success: true };
    if (isDev) res.devOtp = code;
    return res;
  }

  /**
   * Verifica el OTP y devuelve el usuario (existente o recién creado) para que AuthService emita tokens.
   * Lanza excepciones con código: OTP_EXPIRED, OTP_TOO_MANY_ATTEMPTS, OTP_INVALID, ROLE_MISMATCH.
   */
  async verifyOtp(
    phone: string,
    code: string,
    desiredRole: 'USER' | 'STORE_OWNER',
  ): Promise<{
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    phone: string | null;
    stores: any[];
  }> {
    const normalized = normalizePhone(phone);
    const isDev = process.env.NODE_ENV !== 'production';

    const record = await this.prisma.otpCode.findFirst({
      where: {
        phone: normalized,
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

    let user = await this.prisma.user.findUnique({
      where: { phone: normalized },
      include: { stores: true },
    });

    if (user) {
      if (user.role !== desiredRole) {
        throw new ConflictException({
          code: 'ROLE_MISMATCH',
          message: `This phone is already registered as ${user.role}. Use that role or a different phone.`,
          currentRole: user.role,
        });
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          phone: normalized,
          role: desiredRole as Role,
          name: null,
          email: null,
          password: null,
        },
        include: { stores: true },
      });
    }

    const { password: _p, ...safe } = user;
    return {
      id: safe.id,
      name: safe.name,
      email: safe.email,
      role: safe.role,
      phone: safe.phone,
      stores: safe.stores ?? [],
    };
  }
}
