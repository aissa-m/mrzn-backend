import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query,
  UseGuards, UseInterceptors, UploadedFiles, BadRequestException
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiOkResponse, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { QueryProductsDto } from './dto/query-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Crear producto (dueño de la tienda o admin) con imágenes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Post()
  @UseInterceptors(FilesInterceptor('images', 6, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por archivo
    fileFilter: (req, file, cb) => {
      const ok = ['image/jpeg','image/png','image/webp','image/avif'].includes(file.mimetype);
      cb(ok ? null : new BadRequestException('Tipo de archivo no permitido'), ok);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Crear producto con imágenes',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Café molido' },
        description: { type: 'string', example: 'Paquete 250g' },
        price: { type: 'number', example: 3.5 },
        storeId: { type: 'number', example: 1 },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['name','price','storeId'],
    },
  })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // ⬇️ ahora sí: pasamos userId, dto y files
    return this.productsService.create(user.id, dto, files);
  }

  @Get('by-store')
  findByStore(@Query('storeId') storeId?: string) {
    if (!storeId) return [];
    return this.productsService.findAllByStore(Number(storeId));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.id, Number(id), dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.productsService.remove(user.id, Number(id));
  }

  @Get()
  @ApiOkResponse({ description: 'Listado de productos paginado con filtros' })
  @ApiQuery({ name: 'storeId', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'café' })
  @ApiQuery({ name: 'minPrice', required: false, type: String, example: '1.00' })
  @ApiQuery({ name: 'maxPrice', required: false, type: String, example: '5.00' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'price', 'name'], example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], example: 'desc' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async list(@Query() q: QueryProductsDto) {
    return this.productsService.findManyWithQuery(q);
  }
}
