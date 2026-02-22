import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class QueryFavoritesDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @IsPositive()
  limit?: number = 20;
}
