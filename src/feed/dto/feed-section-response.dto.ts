import { ApiProperty } from '@nestjs/swagger';
import { FeedSectionType } from './feed-section-type.enum';
import type { FeedStoreDto } from './feed-item.dto';

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
  @ApiProperty({
    enum: ['ACTIVE', 'RESERVED', 'SOLD', 'PAUSED'],
    description:
      'Estado del producto en el marketplace. ACTIVE = visible y disponible, RESERVED = visible pero reservado, SOLD = vendido (oculto en listados públicos), PAUSED = pausado/oculto.',
  })
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PAUSED';

  @ApiProperty({ enum: ['STORE', 'PERSONAL'] })
  sellerType: 'STORE' | 'PERSONAL';

  @ApiProperty({ required: false, description: 'Si sellerType es STORE' })
  store?: FeedStoreDto;
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
