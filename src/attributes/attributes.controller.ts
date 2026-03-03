// src/attributes/attributes.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { CreateCategoryAttributeDto } from './dto/create-category-attribute.dto';
import { UpdateCategoryAttributeDto } from './dto/update-category-attribute.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { SetProductAttributeValuesDto } from './dto/set-product-attribute-values.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductOwnerGuard } from '../auth/guards/product-owner.guard';
import { ApiOkResponse, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('attributes')
@Controller()
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  /**
   * GET /categories/:categoryId/attributes
   * Obtiene todos los atributos de una categoría con sus opciones
   * Público - Retorna [] si no hay atributos, 404 si la categoría no existe
   */
  @Get('categories/:categoryId/attributes')
  @ApiOperation({ summary: 'Obtener atributos de una categoría' })
  @ApiOkResponse({ description: 'Lista de atributos de la categoría' })
  async getCategoryAttributes(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.attributesService.getCategoryAttributes(categoryId);
  }

  /**
   * GET /attributes/:attributeId/options
   * Lista opciones de un atributo (SELECT/MULTISELECT). Con parentOptionId devuelve solo opciones hijas (selects dependientes).
   * Público - para formularios de creación/edición de producto.
   */
  @Get('attributes/:attributeId/options')
  @ApiOperation({
    summary: 'Obtener opciones de un atributo (opcionalmente filtradas por opción padre)',
  })
  @ApiOkResponse({ description: 'Lista de opciones del atributo' })
  async getAttributeOptions(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Query('parentOptionId') parentOptionId?: string,
  ) {
    const hasParentParam =
      parentOptionId !== undefined && parentOptionId !== '';

    if (!hasParentParam) {
      return this.attributesService.getAttributeOptions(attributeId);
    }

    const parsedParentId = parseInt(parentOptionId, 10);

    if (Number.isNaN(parsedParentId)) {
      return this.attributesService.getAttributeOptions(attributeId);
    }

    return this.attributesService.getAttributeOptions(attributeId, parsedParentId);
  }

  /**
   * GET /products/:productId/attributes
   * Obtiene los valores de atributos de un producto
   * Público
   */
  @Get('products/:productId/attributes')
  @ApiOperation({ summary: 'Obtener valores de atributos de un producto' })
  @ApiOkResponse({ description: 'Lista de valores de atributos del producto' })
  async getProductAttributeValues(
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.attributesService.getProductAttributeValues(productId);
  }

  /**
   * POST /categories/:categoryId/attributes
   * Crea un nuevo atributo para una categoría
   * Requiere: ADMIN
   */
  @Post('categories/:categoryId/attributes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear un atributo para una categoría' })
  @ApiOkResponse({ description: 'Atributo creado exitosamente' })
  async createCategoryAttribute(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: CreateCategoryAttributeDto,
  ) {
    return this.attributesService.createCategoryAttribute(categoryId, dto);
  }

  /**
   * PATCH /attributes/:attributeId
   * Actualiza un atributo existente
   * Requiere: ADMIN
   */
  @Patch('attributes/:attributeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar un atributo' })
  @ApiOkResponse({ description: 'Atributo actualizado exitosamente' })
  async updateCategoryAttribute(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Body() dto: UpdateCategoryAttributeDto,
  ) {
    return this.attributesService.updateCategoryAttribute(attributeId, dto);
  }

  /**
   * POST /attributes/:attributeId/options
   * Añade una opción a un atributo de tipo SELECT/MULTISELECT
   * Requiere: ADMIN
   */
  @Post('attributes/:attributeId/options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Añadir una opción a un atributo' })
  @ApiOkResponse({ description: 'Opción creada exitosamente' })
  async addAttributeOption(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Body() dto: CreateAttributeOptionDto,
  ) {
    return this.attributesService.addAttributeOption(attributeId, dto);
  }

  /**
   * POST /products/:productId/attributes
   * Establece los valores de atributos para un producto
   * Requiere: Propietario del producto o ADMIN
   */
  @Post('products/:productId/attributes')
  @UseGuards(JwtAuthGuard, ProductOwnerGuard)
  @ApiOperation({ summary: 'Establecer valores de atributos de un producto' })
  @ApiOkResponse({ description: 'Valores de atributos establecidos exitosamente' })
  async setProductAttributeValues(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: SetProductAttributeValuesDto,
  ) {
    return this.attributesService.setProductAttributeValues(
      productId,
      dto.values,
    );
  }
}

