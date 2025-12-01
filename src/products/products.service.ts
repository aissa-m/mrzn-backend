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
      // 1) crear el producto primero (sin imágenes)
      const product = await this.prisma.product.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          price: new Prisma.Decimal(String(dto.price)), // acepta "3.50" o 3.5
          storeId: Number(dto.storeId), // 👈 forzamos número
        },
      });

      // 2) subir imágenes (si hay) a carpeta products/{product.id}
      const results = await Promise.allSettled(
        (files ?? []).map((f) =>
          this.s3Service.uploadFile(f, `products/${product.id}`),
        ),
      );

      // normalizar: aceptar tanto string (URL) como {url,key}
      const uploaded = results
        .filter(
          (r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled',
        )
        .map((r) => (typeof r.value === 'string' ? { url: r.value } : r.value));

      // si hubo ficheros y nada subió, avisar (400) en vez de 500
      if ((files?.length ?? 0) > 0 && uploaded.length === 0) {
        console.error('S3 upload errors:', results);
        throw new BadRequestException('No se pudieron subir las imágenes a S3');
      }

      // 3) guardar las imágenes en BD
      if (uploaded.length > 0) {
        await this.prisma.productImage.createMany({
          data: uploaded.map(({ url }) => ({ productId: product.id, url })),
        });
      }

      // 4) devolver el producto con imágenes
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

  async update(userId: number, id: number, dto: UpdateProductDto) {
    const product = await this.findOne(id);
    const owns = await this.ownership.isStoreOwner(userId, product.storeId);
    if (!owns) throw new ForbiddenException('Not the store owner');

    return this.prisma.product.update({
      where: { id },
      data: { ...dto },
    });
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
