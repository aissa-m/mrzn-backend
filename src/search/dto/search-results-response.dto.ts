import { ApiProperty } from '@nestjs/swagger';

/** Store básico dentro de un resultado de búsqueda */
export class SearchResultStoreDto {
  @ApiProperty()
  storeId: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  logoImageUrl: string | null;
}

/** Un item en GET /search/results (estructura similar a feed/recent) */
export class SearchResultItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty({ nullable: true })
  coverImage: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ nullable: true })
  categoryId: number | null;

  @ApiProperty({ nullable: true })
  categoryName: string | null;

  @ApiProperty()
  userId: number;

  @ApiProperty({
    enum: ['ACTIVE', 'RESERVED', 'SOLD', 'PAUSED'],
    description:
      'Estado del producto en el marketplace. ACTIVE = visible y disponible, RESERVED = visible pero reservado, SOLD = vendido (oculto en listados públicos), PAUSED = pausado/oculto.',
  })
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'PAUSED';

  @ApiProperty({ enum: ['STORE', 'PERSONAL'] })
  sellerType: 'STORE' | 'PERSONAL';

  @ApiProperty({ required: false })
  store?: SearchResultStoreDto;
}

/** Respuesta de GET /search/results (cursor pagination, infinite scroll) */
export class SearchResultsResponseDto {
  @ApiProperty({ type: [SearchResultItemDto] })
  items: SearchResultItemDto[];

  @ApiProperty({ nullable: true, description: 'Cursor para la siguiente página' })
  nextCursor: string | null;

  @ApiProperty()
  hasMore: boolean;
}
