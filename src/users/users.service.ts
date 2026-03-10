import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { MeProfileResponseDto } from './dto/me-profile-response.dto';
import {
  COMPLETED_ORDER_STATUSES,
  IN_PROGRESS_ORDER_STATUSES,
  ORDER_STATUS_TO_TRANSACTION,
  TransactionStatusFilter,
} from './constants/transaction-status';
import { QueryMyTransactionsDto } from './dto/query-my-transactions.dto';
import { PaginatedTransactionsResponseDto } from './dto/paginated-transactions-response.dto';
import { TransactionDetailResponseDto } from './dto/transaction-detail-response.dto';
import { TransactionItemDto } from './dto/transaction-item.dto';
import { TransactionPartyDto } from './dto/transaction-party.dto';
import { QueryPublicProfileDto } from './dto/query-public-profile.dto';
import { PublicProfileResponseDto } from './dto/public-profile-response.dto';

/** Moneda por defecto (Product no tiene campo currency en BD) */
const DEFAULT_CURRENCY = 'MRU';

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

  /**
   * Estadísticas de perfil reutilizadas por getMeProfile y getPublicProfile.
   * productsCount, purchasesCount, salesCount sin N+1.
   */
  private async getProfileStats(userId: number): Promise<{
    productsCount: number;
    purchasesCount: number;
    salesCount: number;
  }> {
    const [productsCount, purchasesCount, salesCount] = await Promise.all([
      this.prisma.product.count({ where: { userId } }),
      this.prisma.order.count({ where: { userId } }),
      this.prisma.store
        .findMany({ where: { ownerId: userId }, select: { id: true } })
        .then((stores) => {
          const storeIds = stores.map((s) => s.id);
          if (storeIds.length === 0) return 0;
          return this.prisma.order.count({
            where: { storeId: { in: storeIds } },
          });
        }),
    ]);
    return { productsCount, purchasesCount, salesCount };
  }

  /**
   * Perfil ligero para la pantalla principal de perfil (GET /users/me/profile).
   * Consultas en paralelo; sin datos sensibles. rating/reviewsCount preparados para Review.
   */
  async getMeProfile(userId: number): Promise<MeProfileResponseDto> {
    const [user, stats] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
      this.getProfileStats(userId),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      productsCount: stats.productsCount,
      salesCount: stats.salesCount,
      purchasesCount: stats.purchasesCount,
      rating: null,
      reviewsCount: 0,
    };
  }

  /**
   * Perfil público para la pantalla "mi perfil público / mis productos" (GET /users/me/public-profile).
   * Devuelve user (sin datos sensibles), stats (reutilizando getProfileStats), rating/reviewsCount
   * como null/0, y lista paginada de productos del usuario con thumbnail y favoriteCount.
   * lastActiveAt, responseTime, responseRate no existen en BD → null en stats.
   */
  async getPublicProfile(
    userId: number,
    dto: QueryPublicProfileDto,
  ): Promise<PublicProfileResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const [user, stats, productsResult] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      this.getProfileStats(userId),
      this.prisma.$transaction([
        this.prisma.product.count({ where: { userId } }),
        this.prisma.product.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
            status: true,
            createdAt: true,
            images: { take: 1, orderBy: { id: 'asc' }, select: { url: true } },
            _count: { select: { favorites: true } },
          } as any,
        }),
      ]),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [productsTotal, productsRaw] = productsResult as [number, any[]];

    return {
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        rating: null,
        reviewsCount: 0,
      },
      stats: {
        productsCount: stats.productsCount,
        salesCount: stats.salesCount,
        purchasesCount: stats.purchasesCount,
        lastActiveAt: null,
        responseTime: null,
        responseRate: null,
      },
      products: {
        items: productsRaw.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          currency: DEFAULT_CURRENCY,
          thumbnailUrl: p.images[0]?.url ?? null,
          createdAt: p.createdAt,
          favoriteCount: p._count.favorites,
          isActive: (p as { isActive?: boolean }).isActive ?? true,
          status: (p.status ?? 'ACTIVE') as any,
        })),
        total: productsTotal,
        page,
        limit,
        pages: Math.ceil(productsTotal / limit) || 1,
      },
    };
  }

  /**
   * Lista de compras del usuario (pedidos donde userId === user.id).
   * Paginada, filtrable por estado (in_progress | completed | all), orden por fecha descendente.
   * Sin N+1: una sola query con include de store.owner e items con primera imagen del producto.
   */
  async getMyPurchases(
    userId: number,
    dto: QueryMyTransactionsDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const statusFilter = dto.status ?? 'all';

    const where: { userId: number; status?: { in: OrderStatus[] } } = { userId };
    if (statusFilter === 'in_progress') where.status = { in: IN_PROGRESS_ORDER_STATUSES };
    else if (statusFilter === 'completed') where.status = { in: COMPLETED_ORDER_STATUSES };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          createdAt: true,
          total: true,
          store: {
            select: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          items: {
            select: {
              product: {
                select: {
                  images: { take: 1, orderBy: { id: 'asc' }, select: { url: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const items: TransactionItemDto[] = orders.map((order) =>
      this.toTransactionItem(
        order.id,
        order.status,
        order.createdAt,
        order.total,
        order.items.length,
        this.toPartyDto(order.store.owner),
        order.items[0]?.product?.images?.[0]?.url ?? null,
      ),
    );

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Lista de ventas del usuario (pedidos de tiendas cuyo ownerId === user.id).
   * Una sola query con where store.ownerId, sin N+1.
   */
  async getMySales(
    userId: number,
    dto: QueryMyTransactionsDto,
  ): Promise<PaginatedTransactionsResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const statusFilter = dto.status ?? 'all';

    const where: { store: { ownerId: number }; status?: { in: OrderStatus[] } } = {
      store: { ownerId: userId },
    };
    if (statusFilter === 'in_progress') where.status = { in: IN_PROGRESS_ORDER_STATUSES };
    else if (statusFilter === 'completed') where.status = { in: COMPLETED_ORDER_STATUSES };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          createdAt: true,
          total: true,
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          items: {
            select: {
              product: {
                select: {
                  images: { take: 1, orderBy: { id: 'asc' }, select: { url: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const items: TransactionItemDto[] = orders.map((order) =>
      this.toTransactionItem(
        order.id,
        order.status,
        order.createdAt,
        order.total,
        order.items.length,
        this.toPartyDto(order.user),
        order.items[0]?.product?.images?.[0]?.url ?? null,
      ),
    );

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Detalle de una transacción (compra o venta) por ID de pedido.
   * Solo accesible si el usuario es el comprador (Order.userId) o el vendedor (Store.ownerId).
   * Una sola query: pedido + comprador + tienda/owner + items con producto (nombre + primera imagen).
   * otherParty: vendedor si el usuario es comprador; comprador si es vendedor.
   * productName: nombre del primer producto si hay uno; "{n} products" si hay varios.
   */
  async getTransactionById(
    userId: number,
    orderId: number,
  ): Promise<TransactionDetailResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [
          { userId },
          { store: { ownerId: userId } },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        total: true,
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        store: {
          select: {
            owner: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        items: {
          select: {
            product: {
              select: {
                name: true,
                images: { take: 1, orderBy: { id: 'asc' }, select: { url: true } },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Transaction not found');
    }

    const isBuyer = order.user.id === userId;
    const otherPartyUser = isBuyer ? order.store.owner : order.user;
    const productCount = order.items.length;
    const thumbnailUrl =
      order.items[0]?.product?.images?.[0]?.url ?? null;
    const productName =
      productCount === 1
        ? order.items[0].product.name
        : `${productCount} products`;

    return {
      orderId: order.id,
      status: order.status,
      transactionStatus: ORDER_STATUS_TO_TRANSACTION[order.status],
      createdAt: order.createdAt,
      totalAmount: Number(order.total),
      productCount,
      otherParty: this.toPartyDto(otherPartyUser),
      thumbnailUrl,
      productName,
    };
  }

  private toPartyDto(user: {
    id: number;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  }): TransactionPartyDto {
    const name =
      user.name?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      'Usuario';
    return { id: user.id, name, avatarUrl: user.avatarUrl ?? null };
  }

  private toTransactionItem(
    orderId: number,
    status: OrderStatus,
    createdAt: Date,
    total: unknown,
    productCount: number,
    otherParty: TransactionPartyDto,
    thumbnailUrl: string | null,
  ): TransactionItemDto {
    return {
      orderId,
      status,
      transactionStatus: ORDER_STATUS_TO_TRANSACTION[status],
      createdAt,
      totalAmount: Number(total),
      productCount,
      otherParty,
      thumbnailUrl,
    };
  }
}
