import { IsInt, IsOptional, IsString, IsEnum, IsNumber, Min, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchProductsDto {
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (value ?? '').trim())
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  storeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number = 20;

  @IsOptional()
  @IsEnum(['createdAt', 'price', 'name'])
  orderBy?: 'createdAt' | 'price' | 'name' = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
