import { ApiProperty } from '@nestjs/swagger';
import { FeedSectionType } from './feed-section-type.enum';

/**
 * Item de sección cuando el tipo es TRENDING o BEST_VALUE (producto).
 */
export class FeedSectionProductItemDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
  @ApiProperty()
  price: number;
  @ApiProperty({ nullable: true, description: 'Primera imagen del producto' })
  coverImage: string | null;
}

/**
 * Item de sección cuando el tipo es SHOPS (tienda).
 */
export class FeedSectionShopItemDto {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
  @ApiProperty({ nullable: true, description: 'Logo de la tienda' })
  logoImageUrl: string | null;
}

export type FeedSectionItemDto =
  | FeedSectionProductItemDto
  | FeedSectionShopItemDto;

/**
 * Respuesta de GET /feed/section.
 * items: hasta 20 elementos según el tipo de sección.
 */
export class FeedSectionResponseDto {
  @ApiProperty({
    enum: FeedSectionType,
    description: 'Tipo de sección solicitado',
  })
  type: FeedSectionType;

  @ApiProperty({
    description:
      'Elementos de la sección: productos (TRENDING/BEST_VALUE) o tiendas (SHOPS)',
    type: 'array',
    items: {},
  })
  items: FeedSectionItemDto[];
}
