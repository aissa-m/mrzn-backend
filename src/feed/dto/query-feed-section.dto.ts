import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FeedSectionType } from './feed-section-type.enum';

/**
 * Query param para GET /feed/section.
 * type: identifica la sección solicitada (TRENDING | BEST_VALUE | SHOPS).
 */
export class QueryFeedSectionDto {
  @ApiProperty({
    enum: FeedSectionType,
    description: 'Tipo de sección del Home',
    example: FeedSectionType.TRENDING,
  })
  @IsEnum(FeedSectionType, {
    message: `type debe ser uno de: ${Object.values(FeedSectionType).join(', ')}`,
  })
  type: FeedSectionType;
}
