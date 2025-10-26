// src/chat/dto/pagination.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number = 20;
}

export class CursorDto {
  // paginación por cursor: createdAt/id del último mensaje recibido
  @IsOptional()
  cursor?: string; // formato: "<createdAtISO>_<id>"

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 30;
}
