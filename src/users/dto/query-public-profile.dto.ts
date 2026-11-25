import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query params para GET /users/me/public-profile.
 * Paginación de la lista de productos del usuario.
 */
export class QueryPublicProfileDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Página (1-based)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 1 : parseInt(value, 10)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 20, description: 'Productos por página (máx. 20)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 20 : parseInt(value, 10)))
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 20;
}
