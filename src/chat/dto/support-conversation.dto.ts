import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class SupportConversationDto {
  @ApiPropertyOptional({
    enum: ['en', 'fr', 'ar'],
    description:
      'Optional language code for the initial support welcome message (en, fr, ar).',
  })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'fr', 'ar'])
  lang?: string;
}

