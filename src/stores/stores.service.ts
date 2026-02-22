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
      data: {
        ownerId,
        name: dto.name,
        description: dto.description,
        logoImageUrl: dto.logoImageUrl,
        coverImageUrl: dto.coverImageUrl,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        whatsappNumber: dto.whatsappNumber,
        address: dto.address,
        city: dto.city,
        region: dto.region,
        facebookUrl: dto.facebookUrl,
        instagramUrl: dto.instagramUrl,
        twitterUrl: dto.twitterUrl,
        tiktokUrl: dto.tiktokUrl,
        websiteUrl: dto.websiteUrl,
        status: dto.status,
      },
    });
  }

  async findAll() {
    const stores = await this.prisma.store.findMany({
      where: { status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return stores.map((store) => ({
      ...store,
      productsCount: store._count.products,
    }));
  }

  async findAllByOwner(ownerId: number) {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return stores.map((store) => ({
      ...store,
      productsCount: store._count.products,
    }));
  }

  async findOne(id: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return {
      ...store,
      productsCount: store._count.products,
    };
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

    const productsCount = await this.prisma.product.count({
      where: { storeId: id },
    });

    if (productsCount > 0) {
      throw new ForbiddenException(
        'Cannot delete a store that has associated products',
      );
    }

    await this.prisma.store.delete({ where: { id } });
    return { ok: true };
  }
}
