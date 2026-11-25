// src/products/dto/create-product.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  IsEnum,
} from 'class-validator';

export enum ListingModeDto {
  PERSONAL = 'PERSONAL',
  STORE = 'STORE',
}

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

  /// @deprecated Ignorado. Productos siempre del usuario; mostrar "como tienda" depende de sellerMode/store.
  @IsOptional()
  @IsEnum(ListingModeDto)
  listingMode?: ListingModeDto;

  /// @deprecated Ignorado. No se usa para ownership.
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @IsPositive()
  storeId?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId: number;
}
