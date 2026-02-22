import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  @IsInt({ message: 'productId must be a valid integer' })
  productId!: number;

  @Transform(({ value }) => (value !== undefined && value !== '' ? parseInt(value, 10) : value))
  @IsInt({ message: 'quantity must be an integer' })
  @Min(0, { message: 'quantity must be 0 or greater (0 removes the item)' })
  @Max(99, { message: 'quantity must not exceed 99' })
  quantity!: number;
}
