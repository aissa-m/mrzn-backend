import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // 👇 ahora devolvemos también el user, no solo el token
  async register({ name, email, password }: RegisterDto): Promise<{
    access_token: string;
    user: {
      id: number;
      name?: string;
      email?: string;
      role: string;
      phone?: string;
      stores: any[];
    };
  }> {
    const exists = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }, // basta con saber si existe
    });
    if (exists) throw new BadRequestException('Email ya registrado');

    const hash = await bcrypt.hash(password, 10);

    // creamos el usuario (por defecto role = USER)
    const user = await this.prisma.user.create({
      data: { name, email, password: hash },
      include: {
        stores: true, // aunque será [], así unificamos con login
      },
    });

    // quitamos password antes de firmar
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safeUser } = user;

    return this.sign(safeUser);
  }

  async login({ email, password }: LoginDto): Promise<{
    access_token: string;
    user: {
      id: number;
      name?: string;
      email?: string;
      role: string;
      phone?: string;
      stores: any[];
    };
  }> {
    // incluimos stores para los STORE_OWNER
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        stores: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // quitamos password antes de devolver
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safeUser } = user;

    return this.sign(safeUser);
  }

  // safeUser ya no tiene password y sí tiene stores (email/name opcionales para OTP)
  private sign(user: {
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    phone?: string | null;
    stores?: any[];
  }) {
    const payload: { sub: number; email?: string; phone?: string; role: string } =
      { sub: user.id, role: user.role };
    if (user.email) payload.email = user.email;
    if (user.phone) payload.phone = user.phone;

    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        name: user.name ?? undefined,
        email: user.email ?? undefined,
        role: user.role,
        phone: user.phone ?? undefined,
        stores: user.stores ?? [],
      },
    };
  }

  /**
   * Emite tokens para un usuario ya validado (p. ej. tras OTP verify).
   * Devuelve access_token y user (misma forma que register/login).
   */
  signOtpUser(user: {
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    phone: string | null;
    stores?: any[];
  }) {
    return this.sign(user);
  }
}
