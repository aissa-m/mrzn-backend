// src/products/dto/update-product.dto.ts
import { IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsPositive()
  @IsOptional()
  price?: number;
}
