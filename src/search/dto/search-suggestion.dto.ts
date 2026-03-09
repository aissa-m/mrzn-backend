import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SearchSuggestionSource = 'product' | 'generic';

export type SearchSuggestionKind = 'product_name' | 'category' | 'store' | 'keyword';

/**
 * Una sugerencia de búsqueda: producto/categoría/tienda real o término genérico por idioma.
 */
export class SearchSuggestionDto {
  @ApiProperty({ example: 'Toyota Prado 2015' })
  value: string;

  @ApiProperty({ enum: ['product', 'generic'] })
  source: SearchSuggestionSource;

  @ApiPropertyOptional({ enum: ['product_name', 'category', 'store', 'keyword'] })
  kind?: SearchSuggestionKind;

  @ApiPropertyOptional({ description: 'Id del producto o categoría cuando source es product' })
  id?: number;
}
