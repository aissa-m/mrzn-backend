// src/attributes/dto/update-category-attribute.dto.ts
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { AttributeType } from '@prisma/client';

export class UpdateCategoryAttributeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

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
  minValue?: number | null;

  @ValidateIf((o) => o.type === 'NUMBER')
  @IsOptional()
  @IsNumber()
  maxValue?: number | null;
}

