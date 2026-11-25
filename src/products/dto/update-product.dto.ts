// src/products/dto/update-product.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ListingModeDto } from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  // ⚠️ OJO: sin @IsArray, lo normalizaremos a mano en el service
  @IsOptional()
  removeImageIds?: (number | string)[]; // puede llegar como string o string[]

  // 👇 Campo "dummy" para que ValidationPipe no se queje de images en multipart
  @IsOptional()
  images?: any; // no lo usamos, los archivos vienen en @UploadedFiles()

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  categoryId?: number;

  /** @deprecated Ignorado. Ownership siempre por userId. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  storeId?: number;

  /** @deprecated Ignorado. */
  @IsOptional()
  @IsEnum(ListingModeDto)
  listingMode?: ListingModeDto;
}
