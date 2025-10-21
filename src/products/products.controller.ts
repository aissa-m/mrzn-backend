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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { QueryProductsDto } from './dto/query-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  // Crear producto (dueño de la tienda o admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STORE_OWNER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.id, dto);
  }

  // Productos de una tienda (público o protégelo si quieres)
  @Get()
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
  // (ApiQuery es opcional porque ya infiere del DTO, pero lo dejo si quieres ejemplos visibles)
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
