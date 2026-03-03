// src/attributes/dto/create-category-attribute.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttributeType } from '@prisma/client';

export class CreateCategoryAttributeDto {
  @IsString()
  name: string;

  @IsEnum(AttributeType)
  type: AttributeType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  group?: string;

  @ValidateIf((o) => o.type === 'NUMBER')
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ValidateIf((o) => o.type === 'NUMBER')
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  /** Atributo del que depende (ej. Model depende de Make). Solo permitido para SELECT/MULTISELECT. */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dependsOnAttributeId?: number;
}

