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

type UploadResult = { url: string; key: string };

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private s3Service: S3Service,
  ) { }

  async create(
    userId: number,
    dto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    try {
      // Validar que la categoría existe
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!categoryExists) {
        throw new BadRequestException('La categoría seleccionada no existe');
      }

      // 1) Crear el producto primero (sin imágenes aún)
      const product = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          price: new (Prisma as any).Decimal(String(dto.price)),
          storeId: Number(dto.storeId),
          categoryId: dto.categoryId,
        },
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
      where: { storeId },
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
      price: (p.price as any).toNumber
        ? (p.price as any).toNumber()
        : Number(p.price),
    }));
  }

  async findOne(id: number) {
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
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      ...product,
      price: product.price
        ? ((product.price as any).toNumber?.() ?? Number(product.price))
        : null,
    };
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateProductDto,
    files: Express.Multer.File[] = [],
  ) {
    // console.log('PATCH body dto:', dto, 'files:', files?.length);

    // 1) Comprobar que el producto existe y que es del owner
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const owns = await this.ownership.isStoreOwner(userId, product.storeId);
    if (!owns) throw new ForbiddenException('Not the store owner');

    // 2) Validar categoría si se proporciona
    // Manejar categoryIds (array) tomando el primer elemento, o categoryId (singular) si existe
    const categoryIdToUse = (dto as any).categoryId !== undefined 
      ? (dto as any).categoryId 
      : (dto.categoryIds && dto.categoryIds.length > 0 ? dto.categoryIds[0] : undefined);

    if (categoryIdToUse !== undefined && categoryIdToUse !== null) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: categoryIdToUse },
      });
      if (!categoryExists) {
        throw new BadRequestException('La categoría seleccionada no existe');
      }
    }

    // 3) Preparar datos básicos a actualizar
    const data: any = {};

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

  async remove(userId: number, id: number) {
    const product = await this.findOne(id);
    const owns = await this.ownership.isStoreOwner(userId, product.storeId);
    if (!owns) throw new ForbiddenException('Not the store owner');

    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
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

    // Normalizamos price (Decimal) y las imágenes
    const safeItems = items.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price ? p.price.toNumber() : null,
      storeId: p.storeId,
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
