import {
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
  ) { }

  async create(dto: CreateProductDto, files: Express.Multer.File[]) {
    // Subir imágenes a S3
    const uploadedUrls = await Promise.all(
      (files || []).map((file) => this.s3Service.uploadFile(file)),
    );

    // Crear el producto en la base de datos
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        storeId: dto.storeId,
        images: {
          create: uploadedUrls.map((url) => ({ url })),
        },
      },
      include: { images: true },
    });

    return product;
  }

  async findAllByStore(storeId: number) {
    return this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
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
      ...(storeId ? { storeId } : {}),
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
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
        sortBy,
        sortOrder,
      },
      items,
    };
  }
}
