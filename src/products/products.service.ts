// src/products/products.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/services/ownership.service';
import { SellerContextService } from '../common/services/seller-context.service';
import {
  productSellerPrismaSelect,
  resolveProductSellerPresentation,
} from '../common/utils/product-seller-presentation.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma } from '@prisma/client';
import { QueryProductsDto } from './dto/query-products.dto';
import { S3Service } from 'src/s3/s3.service';
import type { JwtUserPayload } from '../auth/types/auth.types';

type UploadResult = { url: string; key: string };

const PRODUCT_STATUS = {
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  PAUSED: 'PAUSED',
} as const;

type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly sellerContext: SellerContextService,
    private s3Service: S3Service,
  ) {}

  /** Respuesta de detalle / create / update: sin `user`, con `sellerType` y `store` resueltos. */
  private toProductDetailBody(row: Record<string, any>) {
    const { user: _user, store: _rawStore, ...rest } = row;
    const pres = resolveProductSellerPresentation(
      row.userId,
      row.storeId,
      row.store,
      row.user,
    );
    return {
      ...rest,
      ...pres,
      listingMode: row.listingMode ?? 'PERSONAL',
      isActive: row.isActive,
      status: (row as any).status ?? PRODUCT_STATUS.ACTIVE,
      price: row.price
        ? ((row.price as any).toNumber?.() ?? Number(row.price))
        : null,
    };
  }

  async create(
    user: JwtUserPayload,
    dto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    try {
      const userId = Number(user.id);

      // Validar que la categoría existe
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!categoryExists) {
        throw new BadRequestException('La categoría seleccionada no existe');
      }

      const sellerCtx = await this.sellerContext.getSellerContext(userId);

      // Ownership siempre por userId; si puede publicar como tienda, se persiste `storeId` (feed/búsqueda/chat alineados).
      const createData: Prisma.ProductCreateInput = {
        name: dto.name.trim(),
        description: dto.description?.trim() ?? undefined,
        price: new (Prisma as any).Decimal(String(dto.price)),
        user: { connect: { id: userId } },
      };
      if (dto.categoryId != null) {
        createData.category = { connect: { id: dto.categoryId } };
      }
      if (sellerCtx.canPublishAsStore && sellerCtx.store) {
        createData.store = { connect: { id: sellerCtx.store.id } };
      }
      const product = await this.prisma.product.create({
        data: createData,
      });

      // 2) Subir imágenes (si hay)
      const results = await Promise.allSettled<UploadResult>(
        (files ?? []).map((f) =>
          this.s3Service.uploadFile(f, `products/${product.id}`),
        ),
      );

      const uploaded: UploadResult[] = results
        .filter(
          (r): r is PromiseFulfilledResult<UploadResult> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value);

      // Si había ficheros pero no se subió ninguno → error 400
      if ((files?.length ?? 0) > 0 && uploaded.length === 0) {
        console.error('S3 upload errors:', results);
        throw new BadRequestException('No se pudieron subir las imágenes');
      }

      // 3) Guardar las imágenes en BD
      if (uploaded.length > 0) {
        await this.prisma.productImage.createMany({
          data: uploaded.map(({ url }) => ({
            productId: product.id,
            url,
          })),
        });
      }

      const full = await this.prisma.product.findUnique({
        where: { id: product.id },
        include: {
          images: true,
          ...productSellerPrismaSelect,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
      if (!full) {
        throw new NotFoundException('Product not found after create');
      }
      return this.toProductDetailBody(full as any);
    } catch (e) {
      if (
        e instanceof (Prisma as any).PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un producto con ese nombre en esta tienda',
        );
      }
      throw e;
    }
  }

  /** Productos del dueño de la tienda (la tienda es capa visual; los productos son del usuario). */
  async findAllByStore(storeId: number) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        ownerId: true,
        name: true,
        logoUrl: true,
        logoImageUrl: true,
      },
    });
    if (!store) return [];
    const rows = await this.prisma.product.findMany({
      where: {
        userId: store.ownerId,
        status: {
          in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
        },
      } as any,
      include: {
        images: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const storeDto = {
      id: store.id,
      name: store.name,
      logoImageUrl: store.logoUrl ?? store.logoImageUrl ?? null,
    };

    return rows.map((p) => ({
      ...p,
      status: (p as any).status ?? PRODUCT_STATUS.ACTIVE,
      price: (p.price as any).toNumber
        ? (p.price as any).toNumber()
        : Number(p.price),
      sellerType: 'STORE' as const,
      store: storeDto,
    }));
  }

  /**
   * Detalle de producto. Si está inactivo, solo lo ve el propietario o un ADMIN;
   * en caso contrario se devuelve 404 (oculto públicamente).
   */
  async findOne(id: number, user?: JwtUserPayload) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        ...productSellerPrismaSelect,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const productWithUser = product as typeof product & { user: { id: number } };
    const isOwnerOrAdmin =
      user &&
      (productWithUser.user.id === Number(user.id) || user.role === 'ADMIN');

    const status = (product as any).status as ProductStatus | undefined;
    const isVisibleForPublic =
      status === PRODUCT_STATUS.ACTIVE || status === PRODUCT_STATUS.RESERVED;

    if (!isOwnerOrAdmin && !isVisibleForPublic) {
      throw new NotFoundException('Product not found');
    }

    return this.toProductDetailBody(productWithUser as any);
  }

  async update(
    user: JwtUserPayload,
    id: number,
    dto: UpdateProductDto,
    files: Express.Multer.File[] = [],
  ) {
    const userId = Number(user.id);

    // 1) Producto debe existir; solo puede editarlo el dueño (product.userId) o un ADMIN
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        user: { select: { id: true } },
      } as Prisma.ProductInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const productWithUser = product as typeof product & { user: { id: number } };
    const isOwnerOrAdmin =
      productWithUser.user.id === userId || user.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Solo el propietario del producto o un administrador pueden modificarlo',
      );
    }

    // 2) Validar categoría si se proporciona
    const categoryIdToUse = dto.categoryId;

    if (categoryIdToUse !== undefined && categoryIdToUse !== null) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: categoryIdToUse },
      });
      if (!categoryExists) {
        throw new BadRequestException('La categoría seleccionada no existe');
      }
    }

    // 3) Preparar datos básicos a actualizar
    const data: Prisma.ProductUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.description !== undefined) {
      data.description = dto.description || null;
    }

    if (dto.price !== undefined) {
      data.price = new (Prisma as any).Decimal(String(dto.price));
    }

    // Actualizar categoría si se proporciona
    if (categoryIdToUse !== undefined) {
      data.categoryId = categoryIdToUse || null;
    }

    // storeId y listingMode no se actualizan (deprecated; ownership es siempre userId).

    // 4) Aplicar update de datos básicos
    await this.prisma.product.update({
      where: { id },
      data,
    });

    // 4) Borrar imágenes marcadas (solo de este producto)
    let removeIds: number[] = [];

    if (dto.removeImageIds !== undefined) {
      const raw = dto.removeImageIds;

      // Puede venir como "1" | ["1", "2"] | [1, 2]
      const arr = Array.isArray(raw) ? raw : [raw];

      removeIds = arr.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    }

    if (removeIds.length > 0) {
      await this.prisma.productImage.deleteMany({
        where: {
          id: { in: removeIds },
          productId: id,
        },
      });
    }

    // 5) Subir nuevas imágenes (si hay)
    if (files && files.length > 0) {
      const results = await Promise.allSettled(
        files.map((f) => this.s3Service.uploadFile(f, `products/${id}`)),
      );

      const uploaded = results
        .filter(
          (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled',
        )
        .map((r) => (typeof r.value === 'string' ? { url: r.value } : r.value));

      if (files.length > 0 && uploaded.length === 0) {
        console.error('S3 upload errors (update):', results);
        throw new BadRequestException('No se pudieron subir las imágenes a S3');
      }

      if (uploaded.length > 0) {
        await this.prisma.productImage.createMany({
          data: uploaded.map(({ url }) => ({ productId: id, url })),
        });
      }
    }

    // 6) Devolver producto actualizado con imágenes y categoría
    const updated = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        ...productSellerPrismaSelect,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!updated) {
      throw new NotFoundException('Product not found after update');
    }

    return this.toProductDetailBody(updated as any);
  }

  async remove(user: JwtUserPayload, id: number) {
    const userId = Number(user.id);
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, user: { select: { id: true } } } as Prisma.ProductSelect,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const productWithUser = product as unknown as { id: number; user: { id: number } };
    const isOwnerOrAdmin =
      productWithUser.user.id === userId || user.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Solo el propietario del producto o un administrador pueden eliminarlo',
      );
    }
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Activa o desactiva la visibilidad del producto (solo isActive).
   * 404 si no existe; 403 si el usuario no es propietario ni ADMIN.
   */
  async setActive(user: JwtUserPayload, id: number, active: boolean) {
    const userId = Number(user.id);
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const isOwnerOrAdmin = product.userId === userId || user.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Solo el propietario del producto o un administrador pueden cambiar su visibilidad',
      );
    }
    const newStatus: ProductStatus = active
      ? PRODUCT_STATUS.ACTIVE
      : PRODUCT_STATUS.PAUSED;

    await this.prisma.product.update({
      where: { id },
      data: {
        isActive: active,
        status: newStatus,
      } as any,
    });
    return this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        status: true,
        updatedAt: true,
      } as any,
    });
  }

  /**
   * Actualiza el estado del producto en el marketplace (status) y sincroniza isActive.
   * 404 si no existe; 403 si el usuario no es propietario ni ADMIN.
   */
  async setStatus(user: JwtUserPayload, id: number, status: ProductStatus) {
    const userId = Number(user.id);

    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const isOwnerOrAdmin = product.userId === userId || user.role === 'ADMIN';
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Solo el propietario del producto o un administrador pueden cambiar su estado',
      );
    }

    const isActive =
      status === PRODUCT_STATUS.ACTIVE || status === PRODUCT_STATUS.RESERVED;

    await this.prisma.product.update({
      where: { id },
      data: {
        status,
        isActive,
      } as any,
    });

    return this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        updatedAt: true,
      } as any,
    });
  }

  async getRelatedProducts(
    categoryId: number,
    exclude?: number,
    limit: number = 8,
  ) {
    const take = Math.min(Math.max(limit, 1), 20);
    const where: Prisma.ProductWhereInput = {
      status: {
        in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
      },
      categoryId,
      ...(exclude != null ? { id: { not: exclude } } : {}),
    } as any;

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        images: { take: 1 },
        ...productSellerPrismaSelect,
      },
    });

    return products.map((p) => {
      const pres = resolveProductSellerPresentation(
        p.userId,
        p.storeId,
        p.store,
        p.user,
      );
      return {
        id: p.id,
        name: p.name,
        price: (p.price as any).toNumber?.() ?? Number(p.price),
        coverImage: p.images[0]?.url ?? null,
        createdAt: p.createdAt,
        status: (p as any).status ?? PRODUCT_STATUS.ACTIVE,
        sellerType: pres.sellerType,
        store: pres.store,
      };
    });
  }

  async findManyWithQuery(q: QueryProductsDto) {
    const {
      storeId,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = q;

    // Si se filtra por tienda, mostrar productos del dueño de la tienda (productos son del usuario)
    let storeOwnerId: number | undefined;
    if (storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: Number(storeId) },
        select: { ownerId: true },
      });
      storeOwnerId = store?.ownerId;
      if (storeOwnerId == null) {
        return { meta: { page, limit, total: 0, pages: 0, sortBy, sortOrder }, items: [] };
      }
    }

    const where: any = {
      status: {
        in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
      },
      ...(storeOwnerId != null ? { userId: storeOwnerId } : {}),

      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}),

      ...(minPrice ? { price: { gte: new (Prisma as any).Decimal(minPrice) } } : {}),

      ...(maxPrice ? { price: { lte: new (Prisma as any).Decimal(maxPrice) } } : {}),

      ...(q.categoryIds && q.categoryIds.length > 0
        ? {
          categoryId: { in: q.categoryIds },
        }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: true,
          ...productSellerPrismaSelect,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Normalizamos price (Decimal) y las imágenes; solo productos activos en listado público
    const safeItems = items.map((p) => {
      const pres = resolveProductSellerPresentation(
        p.userId,
        p.storeId,
        p.store,
        p.user,
      );
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price ? p.price.toNumber() : null,
        listingMode: (p as any).listingMode ?? 'PERSONAL',
        storeId: p.storeId,
        sellerType: pres.sellerType,
        store: pres.store,
        isActive: (p as any).isActive ?? true,
        status: (p as any).status ?? PRODUCT_STATUS.ACTIVE,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,

        images: p.images.map((img) => img.url),

        mainImage: p.images[0]?.url ?? null,

        category: p.category,
      };
    });

    return {
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        sortBy,
        sortOrder,
      },
      items: safeItems,
    };
  }
}
