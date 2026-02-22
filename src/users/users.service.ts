import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

/** Campos expuestos en GET/PATCH /users/me (sin password ni datos sensibles) */
const ME_SELECT = {
  id: true,
  phone: true,
  role: true,
  name: true,
  email: true,
  firstName: true,
  lastName: true,
  nni: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  region: true,
  postalCode: true,
  country: true,
  avatarUrl: true,
  birthDate: true,
  gender: true,
  createdAt: true,
  stores: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  getMe(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: ME_SELECT,
    });
  }

  async updateMe(userId: number, dto: UpdateMeDto) {
    if (dto.email !== undefined && dto.email !== null && dto.email !== '') {
      const existing = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          id: { not: userId },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: 'Email already in use by another account.',
        });
      }
    }
    // TODO: futura verificación de identidad (ej. validar NNI contra autoridad); por ahora solo guardar y comprobar unicidad
    if (dto.nni !== undefined && dto.nni !== null && dto.nni !== '') {
      const existing = await this.prisma.user.findFirst({
        where: {
          nni: dto.nni,
          id: { not: userId },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'NNI_TAKEN',
          message: 'NNI already in use by another account.',
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email === '' ? null : dto.email;
    if (dto.nni !== undefined) data.nni = dto.nni === '' ? null : dto.nni;
    if (dto.addressLine1 !== undefined) data.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined) data.addressLine2 = dto.addressLine2;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.region !== undefined) data.region = dto.region;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.birthDate !== undefined)
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.gender !== undefined) data.gender = dto.gender;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: ME_SELECT,
    });
  }

  /** Limpia datos personales (set null). No toca role, phone, id, name, email. */
  async clearPersonalInfo(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: null,
        lastName: null,
        nni: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        country: null,
        birthDate: null,
        gender: null,
      },
      select: ME_SELECT,
    });
  }

  async updateAvatar(userId: number, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: ME_SELECT,
    });
  }
}
