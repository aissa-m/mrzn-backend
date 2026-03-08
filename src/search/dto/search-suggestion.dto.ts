import { ApiProperty } from '@nestjs/swagger';

export type SearchSuggestionType = 'product' | 'category';

/**
 * Una sugerencia de búsqueda (producto o categoría).
 * Incluye id opcional para enlazar en frontend.
 */
export class SearchSuggestionDto {
  @ApiProperty({ enum: ['product', 'category'] })
  type: SearchSuggestionType;

  @ApiProperty({ example: 'Zapatillas running' })
  label: string;

  @ApiProperty({ required: false, example: 42 })
  id?: number;
}
