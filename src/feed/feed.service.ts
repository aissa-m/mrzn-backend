import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FeedItemDto } from './dto/feed-item.dto';
import type { FeedRecentResponseDto } from './dto/feed-recent-response.dto';
import type {
  FeedSectionItemDto,
  FeedSectionProductItemDto,
  FeedSectionShopItemDto,
} from './dto/feed-section-response.dto';
import { FeedSectionType } from './dto/feed-section-type.enum';
import { StoreStatus } from '@prisma/client';

const PRODUCT_STATUS = {
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  PAUSED: 'PAUSED',
} as const;

type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

const CURSOR_SEP = '_';

/**
 * Parsea el cursor opaco en { createdAt, id }.
 * Formato: "<createdAtISO>_<id>" (ej: "2024-01-15T12:00:00.000Z_42").
 */
function parseCursor(cursor: string): { createdAt: Date; id: number } | null {
  const i = cursor.lastIndexOf(CURSOR_SEP);
  if (i === -1) return null;
  const createdAtStr = cursor.slice(0, i);
  const idStr = cursor.slice(i + 1);
  const createdAt = new Date(createdAtStr);
  const id = parseInt(idStr, 10);
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(id)) return null;
  return { createdAt, id };
}

/**
 * Genera el cursor opaco para el siguiente page.
 */
function encodeCursor(createdAt: Date, id: number): string {
  return `${createdAt.toISOString()}${CURSOR_SEP}${id}`;
}

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Productos más recientes del marketplace con paginación por cursor.
   * Orden: createdAt desc, id desc. Usa índice (createdAt, id).
   * Si excludeUserId está definido, se excluyen los productos de ese usuario.
   */
  async getRecent(
    limit: number = 20,
    cursor?: string,
    excludeUserId?: number,
  ): Promise<FeedRecentResponseDto> {
    const pageSize = Math.min(Math.max(1, limit), 50);
    const take = pageSize + 1; // +1 para saber si hay más

    const parsed = cursor ? parseCursor(cursor) : null;

    const conditions: object[] = [
      {
        status: {
          in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
        },
      },
    ];
    if (parsed) {
      conditions.push({
        OR: [
          { createdAt: { lt: parsed.createdAt } },
          {
            createdAt: parsed.createdAt,
            id: { lt: parsed.id },
          },
        ],
      });
    }
    if (excludeUserId != null) {
      conditions.push({ userId: { not: excludeUserId } });
    }
    const where = { AND: conditions };

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        name: true,
        price: true,
        createdAt: true,
        userId: true,
        storeId: true,
        categoryId: true,
        status: true,
        category: {
          select: { name: true },
        },
        store: {
          select: {
            id: true,
            name: true,
            logoImageUrl: true,
          },
        },
        images: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { url: true },
        },
      },
    });

    const hasMore = rows.length > pageSize;
    const items = (hasMore ? rows.slice(0, pageSize) : rows) as typeof rows;

    const feedItems: FeedItemDto[] = items.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      coverImage: p.images[0]?.url ?? null,
      createdAt: p.createdAt.toISOString(),
      userId: p.userId,
      categoryId: p.categoryId ?? null,
      categoryName: p.category?.name ?? null,
      status: (p as any).status as ProductStatus,
      ...(p.store && {
        store: {
          storeId: p.store.id,
          name: p.store.name,
          logoImageUrl: p.store.logoImageUrl ?? null,
        },
      }),
    }));

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor(last.createdAt, last.id)
        : null;

    return {
      items: feedItems,
      nextCursor,
      hasMore,
    };
  }

  private static readonly SECTION_PAGE_SIZE = 20;

  /**
   * Sección del Home: hasta 20 elementos según el tipo.
   * TRENDING: productos recientes (createdAt desc).
   * BEST_VALUE: productos por precio ascendente (precio > 0).
   * SHOPS: tiendas activas (createdAt desc).
   * Si excludeUserId está definido, en TRENDING y BEST_VALUE se excluyen los productos de ese usuario.
   */
  async getSection(
    type: FeedSectionType,
    excludeUserId?: number,
  ): Promise<{ type: FeedSectionType; items: FeedSectionItemDto[] }> {
    if (type === FeedSectionType.SHOPS) {
      const stores = await this.prisma.store.findMany({
        where: { status: StoreStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
        take: FeedService.SECTION_PAGE_SIZE,
        select: {
          id: true,
          name: true,
          logoImageUrl: true,
        },
      });
      const items: FeedSectionShopItemDto[] = stores.map((s) => ({
        id: s.id,
        name: s.name,
        logoImageUrl: s.logoImageUrl ?? null,
      }));
      return { type: FeedSectionType.SHOPS, items };
    }

    if (type === FeedSectionType.TRENDING) {
      const products = (await this.prisma.product.findMany({
        where: {
          status: {
            in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
          },
          ...(excludeUserId != null ? { userId: { not: excludeUserId } } : {}),
        } as any,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: FeedService.SECTION_PAGE_SIZE,
        select: {
          id: true,
          name: true,
          price: true,
          status: true,
          images: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { url: true },
          },
        } as any,
      })) as any[];
      const items: FeedSectionProductItemDto[] = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        coverImage: p.images[0]?.url ?? null,
        status: (p as any).status as ProductStatus,
      }));
      return { type: FeedSectionType.TRENDING, items };
    }

    // BEST_VALUE: precio ascendente, solo precios válidos (> 0), solo activos o reservados
    const bestValueWhere: any = {
      status: {
        in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
      },
      price: { gt: 0 },
      ...(excludeUserId != null ? { userId: { not: excludeUserId } } : {}),
    };
    const products = (await this.prisma.product.findMany({
      where: bestValueWhere,
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      take: FeedService.SECTION_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        price: true,
        status: true,
        images: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { url: true },
        },
      } as any,
    })) as any[];
    const items: FeedSectionProductItemDto[] = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      coverImage: p.images[0]?.url ?? null,
      status: (p as any).status as ProductStatus,
    }));
    return { type: FeedSectionType.BEST_VALUE, items };
  }
}
