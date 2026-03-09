import { ApiProperty } from '@nestjs/swagger';

/** Item ligero para la sección destacada de búsqueda (GET /search/featured) */
export class SearchFeaturedItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 29.99 })
  price: number;

  @ApiProperty({ nullable: true })
  coverImage: string | null;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ nullable: true })
  categoryId: number | null;
}
