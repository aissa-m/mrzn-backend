import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { QueryFeedRecentDto } from './dto/query-feed-recent.dto';
import { FeedRecentResponseDto } from './dto/feed-recent-response.dto';
import { QueryFeedSectionDto } from './dto/query-feed-section.dto';
import { FeedSectionResponseDto } from './dto/feed-section-response.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('feed')
@Controller('feed')
@UseGuards(OptionalJwtAuthGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('recent')
  @ApiOkResponse({
    description: 'Productos más recientes del marketplace con paginación por cursor',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Cantidad de productos por página (1-50, default 20)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor opaco devuelto en nextCursor de la respuesta anterior (infinite scroll)',
  })
  getRecent(
    @Query() query: QueryFeedRecentDto,
    @CurrentUser() user: JwtUserPayload | undefined,
  ): Promise<FeedRecentResponseDto> {
    const limit = query.limit ?? 20;
    return this.feedService.getRecent(limit, query.cursor, user?.id);
  }

  @Get('section')
  @ApiOkResponse({
    description: 'Sección del Home: hasta 20 elementos (TRENDING, BEST_VALUE o SHOPS)',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['TRENDING', 'BEST_VALUE', 'SHOPS'],
    description: 'Tipo de sección: TRENDING (recientes), BEST_VALUE (mejor precio), SHOPS (tiendas)',
  })
  getSection(
    @Query() query: QueryFeedSectionDto,
    @CurrentUser() user: JwtUserPayload | undefined,
  ): Promise<FeedSectionResponseDto> {
    return this.feedService.getSection(query.type, user?.id);
  }
}
