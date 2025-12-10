// src/categories/categories.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  private readonly prismaCategory: any;
  
  constructor(private readonly prisma: PrismaService) {
    // Type assertion temporal hasta que se regenere Prisma Client
    // TODO: Regenerar Prisma Client con: npx prisma generate
    this.prismaCategory = (this.prisma as any).category;
  }

  /**
   * Genera un slug URL-friendly a partir de un nombre
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z0-9]+/g, '-') // Reemplaza caracteres especiales con guiones
      .replace(/^-+|-+$/g, '') // Elimina guiones al inicio y final
      .substring(0, 100); // Limita la longitud
  }

  /**
   * Genera un slug único añadiendo un número si es necesario
   */
  private async generateUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prismaCategory.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing || (excludeId && existing.id === excludeId)) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async create(dto: CreateCategoryDto) {
    const baseSlug = this.generateSlug(dto.name);
    const slug = await this.generateUniqueSlug(baseSlug);

    try {
      return await this.prismaCategory.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          slug,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una categoría con ese nombre',
        );
      }
      throw e;
    }
  }

  async findAll(query?: QueryCategoriesDto) {
    const {
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = query || {};

    const where: any = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prismaCategory.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      this.prismaCategory.count({ where }),
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
      items: items.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        slug: cat.slug,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        productCount: cat._count.products,
      })),
    };
  }

  async findOne(id: number) {
    const category = await this.prismaCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productCount: category._count.products,
    };
  }

  async findBySlug(slug: string) {
    const category = await this.prismaCategory.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      slug: category.slug,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      productCount: category._count.products,
    };
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.prismaCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const data: any = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
      // Si cambia el nombre, regeneramos el slug
      const baseSlug = this.generateSlug(dto.name);
      data.slug = await this.generateUniqueSlug(baseSlug, id);
    }

    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }

    try {
      return await this.prismaCategory.update({
        where: { id },
        data,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una categoría con ese nombre o slug',
        );
      }
      throw e;
    }
  }

  async remove(id: number) {
    const category = await this.prismaCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Verificar si tiene productos asociados
    if (category._count.products > 0) {
      throw new BadRequestException(
        `No se puede eliminar la categoría porque tiene ${category._count.products} producto(s) asociado(s)`,
      );
    }

    await this.prismaCategory.delete({ where: { id } });
    return { ok: true };
  }
}

