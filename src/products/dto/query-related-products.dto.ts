// src/products/dto/query-related-products.dto.ts
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export class QueryRelatedProductsDto {
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsInt()
  @IsPositive({ message: 'categoryId debe ser un número positivo' })
  categoryId: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : undefined))
  @IsInt()
  @IsPositive({ message: 'exclude debe ser un número positivo' })
  exclude?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : 8))
  @IsInt()
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(20, { message: 'limit no puede ser mayor que 20' })
  limit?: number = 8;
}
