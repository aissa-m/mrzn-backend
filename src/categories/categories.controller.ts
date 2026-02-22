// src/categories/categories.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { AttributesService } from '../attributes/attributes.service';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly attributesService: AttributesService,
  ) {}

  // Crear categoría (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  // Listar categorías (público)
  @Get()
  @ApiOkResponse({ description: 'Listado de categorías paginado con filtros' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'café' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'name', 'updatedAt'],
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
  findAll(@Query() query?: QueryCategoriesDto) {
    return this.categoriesService.findAll(query);
  }

  // Obtener categoría por slug (público)
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  // Obtener atributos de una categoría (público)
  // IMPORTANTE: Esta ruta debe ir antes de @Get(':id') para que se resuelva correctamente
  @Get(':id/attributes')
  @ApiOkResponse({ description: 'Lista de atributos de la categoría' })
  async getCategoryAttributes(@Param('id', ParseIntPipe) id: number) {
    return this.attributesService.getCategoryAttributes(id);
  }

  // Obtener categoría por ID (público)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(Number(id));
  }

  // Actualizar categoría (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(Number(id), dto);
  }

  // Eliminar categoría (solo ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(Number(id));
  }
}

