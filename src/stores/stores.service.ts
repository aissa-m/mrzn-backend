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

  async update(userId: number, id: number, dto: UpdateStoreDto) {
    const owns = await this.ownership.isStoreOwner(userId, id);
    if (!owns) throw new ForbiddenException('Not the store owner');

    return this.prisma.store.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(userId: number, id: number) {
    const owns = await this.ownership.isStoreOwner(userId, id);
    if (!owns) throw new ForbiddenException('Not the store owner');

    await this.findOne(id); // asegura NotFound
    await this.prisma.product.deleteMany({ where: { storeId: id } }); // cascada “manual” si quieres
    await this.prisma.store.delete({ where: { id } });
    return { ok: true };
  }
}
