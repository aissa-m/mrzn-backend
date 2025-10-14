import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register({ name, email, password }) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('Email ya registrado');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: { name, email, password: hash },
    });
    return this.sign(user);
  }

  async login({ email, password }) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = await this.prisma.user.findUnique({ where: { email } });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.sign(user);
  }

  private sign(user: { id: number; email: string; role?: string }) {
    const payload = { sub: user.id, email: user.email, role: user['role'] };
    return { access_token: this.jwt.sign(payload) };
  }
}
