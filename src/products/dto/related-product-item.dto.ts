import { ApiProperty } from '@nestjs/swagger';

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
}
