import { ApiProperty } from '@nestjs/swagger';
import { PublicProfileUserDto } from './public-profile-user.dto';
import { PublicProfileStatsDto } from './public-profile-stats.dto';
import { PublicProfileProductItemDto } from './public-profile-product-item.dto';

/** Payload paginado de productos dentro del perfil público */
export class PublicProfileProductsDto {
  @ApiProperty({ type: [PublicProfileProductItemDto] })
  items: PublicProfileProductItemDto[];

  @ApiProperty({ description: 'Total de productos del usuario' })
  total: number;

  @ApiProperty({ description: 'Página actual (1-based)' })
  page: number;

  @ApiProperty({ description: 'Tamaño de página' })
  limit: number;

  @ApiProperty({ description: 'Número total de páginas' })
  pages: number;
}

/**
 * Respuesta de GET /users/me/public-profile.
 * Todo lo necesario para la pantalla "mi perfil público / mis productos" (vista móvil).
 */
export class PublicProfileResponseDto {
  @ApiProperty({ type: PublicProfileUserDto })
  user: PublicProfileUserDto;

  @ApiProperty({ type: PublicProfileStatsDto })
  stats: PublicProfileStatsDto;

  @ApiProperty({ type: PublicProfileProductsDto })
  products: PublicProfileProductsDto;
}
