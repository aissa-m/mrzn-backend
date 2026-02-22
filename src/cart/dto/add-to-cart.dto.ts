import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AddToCartDto {
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  @IsInt({ message: 'productId must be a valid integer' })
  productId!: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : 1))
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  @Max(99, { message: 'quantity must not exceed 99' })
  quantity?: number = 1;
}
