import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';

@Injectable()
export class AdminBootstrapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async bootstrap(dto: BootstrapAdminDto): Promise<{
    access_token: string;
    user: {
      id: number;
      name?: string;
      email?: string;
      role: string;
      phone?: string;
      stores: unknown[];
    };
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.trim() },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const hash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim(),
        password: hash,
        role: Role.ADMIN,
      },
      include: {
        stores: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safeUser } = user;

    const payload: { sub: number; email?: string; role: string } = {
      sub: user.id,
      role: user.role,
    };
    if (user.email) payload.email = user.email;

    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: safeUser.id,
        name: safeUser.name ?? undefined,
        email: safeUser.email ?? undefined,
        role: safeUser.role,
        phone: safeUser.phone ?? undefined,
        stores: safeUser.stores ?? [],
      },
    };
  }
}
