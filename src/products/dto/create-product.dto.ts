// src/products/dto/create-product.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength, IsArray, ArrayMinSize } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @Type(() => Number)
  @IsPositive()
  price!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  storeId!: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId: number;
}
