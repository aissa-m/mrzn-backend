import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const STATUS_VALUES = ['in_progress', 'completed', 'all'] as const;

export class QueryMyTransactionsDto {
  @ApiPropertyOptional({
    enum: ['in_progress', 'completed', 'all'],
    default: 'all',
    description:
      'in_progress = PENDING, PAID, SHIPPED; completed = COMPLETED, CANCELED; all = sin filtrar por estado.',
  })
  @IsOptional()
  @IsIn([...STATUS_VALUES])
  @Transform(({ value }) => (value === '' ? undefined : value))
  status?: (typeof STATUS_VALUES)[number] = 'all';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 1 : parseInt(value, 10)))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === '' ? 20 : parseInt(value, 10)))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
