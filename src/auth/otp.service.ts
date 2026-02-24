import {
  Injectable,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { OTP_PROVIDER } from './interfaces/otp-provider.interface';
import type { IOtpProvider } from './interfaces/otp-provider.interface';

/** Normaliza teléfono: trim (el provider recibe ya normalizado) */
export function normalizePhone(phone: string): string {
  return phone.trim();
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OTP_PROVIDER) private readonly provider: IOtpProvider,
  ) {}

  async requestOtp(phone: string, desiredRole: 'USER' | 'STORE_OWNER'): Promise<{
    success: boolean;
    devOtp?: string;
  }> {
    const normalized = normalizePhone(phone);
    return this.provider.requestOtp(normalized);
  }

  /**
   * Verifica el OTP (vía provider) y devuelve el usuario (existente o recién creado) para que AuthService emita tokens.
   * Lanza: OTP_* desde el provider; ROLE_MISMATCH desde aquí.
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
    await this.provider.verifyCode(normalized, code);

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
