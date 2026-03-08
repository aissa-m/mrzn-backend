// src/products/dto/update-product.dto.ts
import { IsOptional, IsString, IsNumber, IsArray, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

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

  /** Tienda a asociar. Si se envía, debe pertenecer al usuario (salvo ADMIN). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  storeId?: number;
}
