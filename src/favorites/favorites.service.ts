import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async getFavorites(userId: number, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              storeId: true,
              categoryId: true,
              createdAt: true,
              updatedAt: true,
              images: { select: { url: true } },
              store: { select: { id: true, name: true } },
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    const products = items.map((f) => {
      const p = f.product as any;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price ? p.price.toNumber() : null,
        storeId: p.storeId,
        categoryId: p.categoryId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        images: p.images?.map((img: { url: string }) => img.url) ?? [],
        mainImage: p.images?.[0]?.url ?? null,
        store: p.store,
        category: p.category,
      };
    });

    return {
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
      items: products,
    };
  }

  async getFavoriteIds(userId: number): Promise<number[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }

  async ensureProductExists(productId: number): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  async toggle(userId: number, productId: number): Promise<{ liked: boolean }> {
    await this.ensureProductExists(productId);

    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existing) {
      await this.prisma.favorite.delete({
        where: { id: existing.id },
      });
      return { liked: false };
    }

    await this.prisma.favorite.create({
      data: { userId, productId },
    });
    return { liked: true };
  }
}
