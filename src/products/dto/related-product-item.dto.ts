import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Tienda resumida alineada con listado/detalle de productos */
export class RelatedProductStoreDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  logoImageUrl: string | null;
}

/**
 * Item ligero de producto para listados (ej. productos relacionados).
 * Usado en GET /products/related.
 */
export class RelatedProductItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty({
    nullable: true,
    description: 'URL de la primera imagen del producto (cover)',
  })
  coverImage: string | null;

  @ApiProperty({ description: 'Fecha de creación del producto' })
  createdAt: Date;

  @ApiProperty({ enum: ['STORE', 'PERSONAL'] })
  sellerType: 'STORE' | 'PERSONAL';

  @ApiPropertyOptional({
    type: RelatedProductStoreDto,
    nullable: true,
    description: 'Presente cuando sellerType es STORE',
  })
  store: RelatedProductStoreDto | null;
}
