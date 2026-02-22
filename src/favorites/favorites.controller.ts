import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QueryFavoritesDto } from './dto/query-favorites.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List favorite products (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of favorite products' })
  getFavorites(
    @CurrentUser() user: { id: number },
    @Query() query: QueryFavoritesDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.favoritesService.getFavorites(user.id, page, limit);
  }

  @Get('ids')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List favorite product IDs (for quick heart state)' })
  @ApiResponse({ status: 200, description: 'Array of product IDs' })
  getFavoriteIds(@CurrentUser() user: { id: number }) {
    return this.favoritesService.getFavoriteIds(user.id);
  }

  @Post('toggle/:productId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Toggle favorite for a product (idempotent)' })
  @ApiResponse({ status: 200, description: 'Returns { liked: true } or { liked: false }' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async toggle(
    @CurrentUser() user: { id: number },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.favoritesService.toggle(user.id, productId);
  }
}
