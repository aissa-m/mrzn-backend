import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AttributesService } from '../../attributes/attributes.service';
import { CreateCategoryAttributeDto } from '../../attributes/dto/create-category-attribute.dto';
import { UpdateCategoryAttributeDto } from '../../attributes/dto/update-category-attribute.dto';
import { CreateAttributeOptionDto } from '../../attributes/dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../../attributes/dto/update-attribute-option.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get('categories/:categoryId/attributes')
  getCategoryAttributes(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.attributesService.getCategoryAttributes(categoryId);
  }

  @Post('categories/:categoryId/attributes')
  createCategoryAttribute(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: CreateCategoryAttributeDto,
  ) {
    return this.attributesService.createCategoryAttribute(categoryId, dto);
  }

  @Delete('attributes/:attributeId')
  deleteCategoryAttribute(
    @Param('attributeId', ParseIntPipe) attributeId: number,
  ) {
    return this.attributesService.deleteCategoryAttribute(attributeId);
  }

  @Get('attributes/:attributeId/options')
  getAttributeOptions(
    @Param('attributeId', ParseIntPipe) attributeId: number,
  ) {
    return this.attributesService.getAttributeOptions(attributeId);
  }

  @Patch('attributes/:attributeId')
  updateCategoryAttribute(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Body() dto: UpdateCategoryAttributeDto,
  ) {
    return this.attributesService.updateCategoryAttribute(attributeId, dto);
  }

  @Post('attributes/:attributeId/options')
  addAttributeOption(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Body() dto: CreateAttributeOptionDto,
  ) {
    return this.attributesService.addAttributeOption(attributeId, dto);
  }

  @Patch('attributes/:attributeId/options/:optionId')
  updateAttributeOption(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdateAttributeOptionDto,
  ) {
    return this.attributesService.updateAttributeOption(
      attributeId,
      optionId,
      dto,
    );
  }

  @Delete('attributes/:attributeId/options/:optionId')
  deleteAttributeOption(
    @Param('attributeId', ParseIntPipe) attributeId: number,
    @Param('optionId', ParseIntPipe) optionId: number,
  ) {
    return this.attributesService.deleteAttributeOption(attributeId, optionId);
  }
}
