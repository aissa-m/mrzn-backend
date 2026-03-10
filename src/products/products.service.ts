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
    private s3Service: S3Service,
  ) { }

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

      // Si se envía storeId, la tienda debe pertenecer al usuario (salvo ADMIN)
      if (dto.storeId != null && dto.storeId !== undefined) {
        const canUseStore =
          user.role === 'ADMIN' ||
          (await this.ownership.isStoreOwner(userId, dto.storeId));
        if (!canUseStore) {
          throw new ForbiddenException(
            'No tienes permiso para asociar el producto a esa tienda',
          );
        }
      }

      // 1) Crear el producto con ProductCreateInput (solo relaciones connect, sin IDs directos)
      const createData: Record<string, unknown> = {
        name: dto.name.trim(),
        description: dto.description?.trim() ?? undefined,
        price: new (Prisma as any).Decimal(String(dto.price)),
        user: { connect: { id: userId } },
      };
      if (dto.categoryId != null) {
        createData.category = { connect: { id: dto.categoryId } };
      }
      if (dto.storeId != null) {
        createData.store = { connect: { id: dto.storeId } };
      }
      const product = await this.prisma.product.create({
        data: createData as Prisma.ProductCreateInput,
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

      // 4) Devolver producto con categoría, imágenes y tienda
      return this.prisma.product.findUnique({
        where: { id: product.id },
        include: {
          images: true,
          store: {
            select: {
              id: true,
              ownerId: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
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

  async findAllByStore(storeId: number) {
    const rows = await this.prisma.product.findMany({
      where: {
        storeId,
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

    // 🔥 Convertimos Decimal → number antes de devolver
    return rows.map((p) => ({
      ...p,
      status: (p as any).status ?? PRODUCT_STATUS.ACTIVE,
      price: (p.price as any).toNumber
        ? (p.price as any).toNumber()
        : Number(p.price),
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
        store: {
          select: {
            id: true,
            ownerId: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        user: { select: { id: true } },
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

    const { user: _u, ...rest } = productWithUser;
    return {
      ...rest,
      isActive: product.isActive,
      status: status ?? PRODUCT_STATUS.ACTIVE,
      price: product.price
        ? ((product.price as any).toNumber?.() ?? Number(product.price))
        : null,
    };
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

    // Si se cambia storeId, validar que la tienda pertenezca al usuario (salvo ADMIN)
    if (dto.storeId !== undefined && dto.storeId !== null) {
      const canUseStore =
        user.role === 'ADMIN' ||
        (await this.ownership.isStoreOwner(userId, dto.storeId));
      if (!canUseStore) {
        throw new ForbiddenException(
          'No tienes permiso para asociar el producto a esa tienda',
        );
      }
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

    // Actualizar storeId si se proporciona (validación de tienda ya hecha arriba)
    if (dto.storeId !== undefined) {
      data.storeId = dto.storeId ?? undefined;
    }

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
        store: {
          select: {
            id: true,
            ownerId: true,
          },
        },
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

    return {
      ...updated,
      price: updated.price
        ? ((updated.price as any).toNumber?.() ?? Number(updated.price))
        : null,
    };
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
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: (p.price as any).toNumber?.() ?? Number(p.price),
      coverImage: p.images[0]?.url ?? null,
      createdAt: p.createdAt,
      status: (p as any).status ?? PRODUCT_STATUS.ACTIVE,
    }));
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

    const where: any = {
      status: {
        in: [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.RESERVED],
      }, // listado público: solo productos visibles (ACTIVOS o RESERVADOS)
      ...(storeId ? { storeId: Number(storeId) } : {}),

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
          store: {
            select: {
              id: true,
              ownerId: true, // 👈 aquí está el vendedor
            },
          },
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
    const safeItems = items.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price ? p.price.toNumber() : null,
      storeId: p.storeId,
      isActive: (p as any).isActive ?? true,
      status: (p as any).status ?? PRODUCT_STATUS.ACTIVE,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,

      images: p.images.map((img) => img.url),

      mainImage: p.images[0]?.url ?? null,

      category: p.category,
    }));

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
