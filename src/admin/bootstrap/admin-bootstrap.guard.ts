import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const HEADER_SECRET = 'x-admin-bootstrap-secret';

@Injectable()
export class AdminBootstrapGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.headers[HEADER_SECRET];

    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected) {
      throw new ForbiddenException('Bootstrap not configured');
    }
    if (typeof secret !== 'string' || secret !== expected) {
      throw new ForbiddenException('Invalid or missing bootstrap secret');
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: Role.ADMIN },
      select: { id: true },
    });
    if (existingAdmin) {
      throw new ConflictException('An admin user already exists');
    }

    return true;
  }
}
