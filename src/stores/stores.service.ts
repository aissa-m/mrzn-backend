import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { OwnershipService } from '../common/services/ownership.service';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async create(ownerId: number, dto: CreateStoreDto) {
    return this.prisma.store.create({
      data: { name: dto.name, ownerId },
    });
  }

  async findAllByOwner(ownerId: number) {
    return this.prisma.store.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  // stores.service.ts
  async update(
    user: { id: number; role: 'USER' | 'STORE_OWNER' | 'ADMIN' },
    id: number,
    dto: UpdateStoreDto,
  ) {
    const allowed = await this.ownership.isStoreOwnerOrAdmin(user, id);
    if (!allowed)
      throw new ForbiddenException('Not allowed to update this store');

    await this.findOne(id);
    return this.prisma.store.update({ where: { id }, data: { ...dto } });
  }

  async remove(
    user: { id: number; role: 'USER' | 'STORE_OWNER' | 'ADMIN' },
    id: number,
  ) {
    const allowed = await this.ownership.isStoreOwnerOrAdmin(user, id);
    if (!allowed)
      throw new ForbiddenException('Not allowed to delete this store');

    await this.findOne(id);
    // ⚠️ Mejor en transacción:
    await this.prisma.$transaction([
      this.prisma.product.deleteMany({ where: { storeId: id } }),
      this.prisma.store.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
