import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetProductActiveDto } from './dto/set-product-active.dto';
import { SetProductStatusDto } from './dto/set-product-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiOkResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { QueryProductsDto } from './dto/query-products.dto';
import { QueryRelatedProductsDto } from './dto/query-related-products.dto';
import { RelatedProductItemDto } from './dto/related-product-item.dto';
import type { JwtUserPayload } from '../auth/types/auth.types';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Crear producto: cualquier usuario autenticado; ownership por product.userId; storeId opcional
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor('images', 6, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por archivo
      fileFilter: (req, file, cb) => {
        const mime = file.mimetype || '';

        // ✅ Aceptar cualquier tipo de imagen (jpeg, png, webp, heic, etc.)
        if (!mime.startsWith('image/')) {
          return cb(
            new BadRequestException('Tipo de archivo no permitido'),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Crear producto con imágenes',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Café molido' },
        description: { type: 'string', example: 'Paquete 250g' },
        price: { type: 'number', example: 3.5 },
        storeId: { type: 'number', example: 1, description: 'Opcional; si se envía debe ser tienda del usuario' },
        categoryIds: {
          type: 'array',
          items: { type: 'number' },
          example: 13,
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['name', 'price'],
    },
  })
  async create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.create(user, dto, files ?? []);
  }

  @Get('by-store')
  findByStore(@Query('storeId') storeId?: string) {
    if (!storeId) return [];
    return this.productsService.findAllByStore(Number(storeId));
  }

  @Get('related')
  @ApiOkResponse({
    description: 'Productos de la misma categoría para tarjetas (ligero)',
    type: [RelatedProductItemDto],
  })
  @ApiQuery({ name: 'categoryId', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'exclude', required: false, type: Number, description: 'ID del producto a excluir (ej. el actual)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 8, description: 'Máximo 20, default 8' })
  getRelated(@Query() q: QueryRelatedProductsDto) {
    const limit = q.limit ?? 8;
    return this.productsService.getRelatedProducts(q.categoryId, q.exclude, limit);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @CurrentUser() user: JwtUserPayload | undefined,
    @Param('id') id: string,
  ) {
    return this.productsService.findOne(Number(id), user);
  }

  // Solo el propietario o ADMIN pueden cambiar visibilidad (isActive)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/active')
  @ApiBody({
    type: SetProductActiveDto,
    description: 'active: true = visible en marketplace, false = pausado',
  })
  @ApiOkResponse({
    description: 'Visibilidad del producto actualizada (isActive)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        isActive: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  setActive(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: SetProductActiveDto,
  ) {
    return this.productsService.setActive(user, Number(id), dto.active);
  }

  // Solo el propietario o ADMIN pueden cambiar el estado (status)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  @ApiBody({
    type: SetProductStatusDto,
    description:
      "Estado del producto en el marketplace. ACTIVE = visible y disponible, RESERVED = visible pero reservado temporalmente, SOLD = vendido, PAUSED = oculto/pausado.",
  })
  @ApiOkResponse({
    description: 'Estado del producto actualizado (status + isActive coherente)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'RESERVED', 'SOLD', 'PAUSED'],
        },
        isActive: { type: 'boolean' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  setStatus(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: SetProductStatusDto,
  ) {
    return this.productsService.setStatus(user, Number(id), dto.status);
  }

  // Solo el propietario (product.userId) o un ADMIN pueden actualizar
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('images', 6, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por archivo
      fileFilter: (req, file, cb) => {
        const ok = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/avif',
        ].includes(file.mimetype);
        cb(
          ok ? null : new BadRequestException('Tipo de archivo no permitido'),
          ok,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Actualizar producto (datos básicos + imágenes + borrado)',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Café molido' },
        description: { type: 'string', example: 'Paquete 250g' },
        price: { type: 'number', example: 3.5 },
        categoryIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2],
        },
        // array de IDs de imágenes a borrar
        removeImageIds: {
          type: 'array',
          items: { type: 'number' },
          example: [1, 2],
        },
        // nuevas imágenes a añadir
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.update(user, Number(id), dto, files);
  }

  // Solo el propietario (product.userId) o un ADMIN pueden eliminar
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.productsService.remove(user, Number(id));
  }

  @Get()
  @ApiOkResponse({ description: 'Listado de productos paginado con filtros' })
  @ApiQuery({ name: 'storeId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'café' })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    type: String,
    example: '1.00',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    type: String,
    example: '5.00',
  })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    type: String,
    description: 'IDs de categorías separados por coma (ej: "1,2,3")',
    example: '1,2',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'price', 'name'],
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async list(@Query() q: QueryProductsDto) {
    return this.productsService.findManyWithQuery(q);
  }
}
