import { FeedItemDto } from './feed-item.dto';

/**
 * Respuesta de GET /feed/recent.
 * nextCursor: si hay más resultados, enviar este valor como cursor en la siguiente petición.
 */
export class FeedRecentResponseDto {
  items: FeedItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
