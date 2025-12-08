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
  ) {}

  async create(
    userId: number,
    dto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    try {
      // (Opcional) validar que la tienda pertenece al usuario o que es admin.
      // Aquí asumo que el guard de rol + lógica previa ya controla eso.

      // 1) Crear el producto primero (sin imágenes)
      const product = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          price: new Prisma.Decimal(String(dto.price)), // acepta "3.50" o 3.5
          storeId: Number(dto.storeId),
        },
      });

      // 2) Subir imágenes (si hay) a carpeta products/{product.id}
      const results = await Promise.allSettled<UploadResult>(
        (files ?? []).map((f) =>
          this.s3Service.uploadFile(f, `products/${product.id}`),
        ),
      );

      // console.log(
      //   'PRODUCT CREATE - uploaded results:',
      //   results.map((r) => (r.status === 'fulfilled' ? r.value : r)),
      // );

      const uploaded: UploadResult[] = results
        .filter(
          (r): r is PromiseFulfilledResult<UploadResult> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value);

      // Si hubo ficheros y nada subió, avisar (400) en vez de 500
      if ((files?.length ?? 0) > 0 && uploaded.length === 0) {
        console.error('S3 upload errors:', results);
        throw new BadRequestException('No se pudieron subir las imágenes a S3');
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

      // 4) Devolver el producto con imágenes y tienda
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
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
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

    // 2) Preparar datos básicos a actualizar
    const data: Prisma.ProductUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.description !== undefined) {
      data.description = dto.description || null;
    }

    if (dto.price !== undefined) {
      data.price = new Prisma.Decimal(String(dto.price));
    }

    // 3) Aplicar update de datos básicos
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

    // 6) Devolver producto actualizado con imágenes
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

    const where: Prisma.ProductWhereInput = {
      ...(storeId ? { storeId: Number(storeId) } : {}),

      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),

      ...(minPrice ? { price: { gte: new Prisma.Decimal(minPrice) } } : {}),

      ...(maxPrice ? { price: { lte: new Prisma.Decimal(maxPrice) } } : {}),
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
