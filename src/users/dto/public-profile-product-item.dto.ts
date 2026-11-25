import { ApiProperty } from '@nestjs/swagger';

export const PUBLIC_PRODUCT_STATUS_VALUES = [
  'ACTIVE',
  'RESERVED',
  'SOLD',
  'PAUSED',
] as const;
export type PublicProductStatus =
  (typeof PUBLIC_PRODUCT_STATUS_VALUES)[number];

/**
 * Item ligero de producto para la lista del perfil público.
 * El modelo Product no tiene campo "status" ni "currency" en BD;
 * currency se devuelve como constante "MRU" (moneda por defecto de la app).
 */
export class PublicProfileProductItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Precio (Decimal como number)' })
  price: number;

  @ApiProperty({ description: 'Moneda por defecto de la app (Product no tiene campo currency en BD)' })
  currency: string;

  @ApiProperty({ nullable: true, description: 'URL de la primera imagen del producto' })
  thumbnailUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Número de usuarios que tienen el producto en favoritos' })
  favoriteCount: number;

  @ApiProperty({
    description: 'Si el producto está visible en el marketplace (false = pausado, solo el dueño lo ve en su zona)',
    default: true,
  })
  isActive: boolean;

  @ApiProperty({
    enum: PUBLIC_PRODUCT_STATUS_VALUES,
    description:
      'Estado del producto en el marketplace. ACTIVE = visible y disponible, RESERVED = visible pero reservado, SOLD = vendido (oculto en listados públicos), PAUSED = pausado/oculto.',
  })
  status: PublicProductStatus;
}
