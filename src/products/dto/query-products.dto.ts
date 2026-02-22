// src/products/dto/query-products.dto.ts
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class QueryProductsDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  storeId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'minPrice debe tener hasta 2 decimales' })
  @IsPositive()
  minPrice?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'maxPrice debe tener hasta 2 decimales' })
  @IsPositive()
  maxPrice?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((v) => parseInt(v, 10));
    }
    if (typeof value === 'string') {
      return value.split(',').map((v) => parseInt(v.trim(), 10));
    }
    return [parseInt(value, 10)];
  })
  @IsArray()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsIn(['createdAt', 'price', 'name'])
  sortBy?: 'createdAt' | 'price' | 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  limit?: number;
}
