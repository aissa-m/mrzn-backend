import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import {
  QuerySearchSuggestionsDto,
  QuerySearchFeaturedDto,
  QuerySearchResultsDto,
} from './dto/query-search.dto';
import type { SearchSuggestionDto } from './dto/search-suggestion.dto';
import type { SearchFeaturedItemDto } from './dto/search-featured-item.dto';
import type { SearchResultsResponseDto } from './dto/search-results-response.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('search')
@Controller('search')
@UseGuards(OptionalJwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggestions')
  @ApiOkResponse({
    description: 'Sugerencias ligeras (productos y categorías) por coincidencia parcial en nombre',
  })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Texto de búsqueda' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5, description: 'Máximo de sugerencias (1-10, default 5)' })
  getSuggestions(
    @Query() query: QuerySearchSuggestionsDto,
  ): Promise<SearchSuggestionDto[]> {
    const limit = query.limit ?? 5;
    return this.searchService.getSuggestions(query.q, limit);
  }

  @Get('featured')
  @ApiOkResponse({
    description: 'Productos destacados para la búsqueda (sección horizontal)',
  })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Texto de búsqueda' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10, description: 'Máximo de productos (1-10, default 10)' })
  getFeatured(
    @Query() query: QuerySearchFeaturedDto,
    @CurrentUser() user: JwtUserPayload | undefined,
  ): Promise<SearchFeaturedItemDto[]> {
    const limit = query.limit ?? 10;
    return this.searchService.getFeatured(query.q, limit, user?.id);
  }

  @Get('results')
  @ApiOkResponse({
    description: 'Resultados completos de búsqueda con paginación por cursor (infinite scroll)',
  })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Texto de búsqueda' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Por página (1-50, default 20)' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Cursor de la página siguiente' })
  getResults(
    @Query() query: QuerySearchResultsDto,
    @CurrentUser() user: JwtUserPayload | undefined,
  ): Promise<SearchResultsResponseDto> {
    const limit = query.limit ?? 20;
    return this.searchService.getResults(
      query.q,
      limit,
      query.cursor,
      user?.id,
    );
  }
}
