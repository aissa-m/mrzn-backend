import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query params para GET /feed/recent (paginación por cursor).
 * cursor: opaco devuelto por la respuesta anterior (formato createdAt_id).
 * limit: cantidad de productos por página (default 20).
 */
export class QueryFeedRecentDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
