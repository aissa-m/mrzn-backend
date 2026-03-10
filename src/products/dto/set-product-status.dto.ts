import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export const PRODUCT_STATUS_VALUES = [
  'ACTIVE',
  'RESERVED',
  'SOLD',
  'PAUSED',
] as const;

export type ProductStatusValue = (typeof PRODUCT_STATUS_VALUES)[number];

/**
 * Body para PATCH /products/:id/status.
 * Cambia el estado del producto en el marketplace (ACTIVE | RESERVED | SOLD | PAUSED).
 */
export class SetProductStatusDto {
  @ApiProperty({
    enum: PRODUCT_STATUS_VALUES,
    description:
      'Estado del producto en el marketplace. ACTIVE = visible y disponible, RESERVED = visible pero reservado temporalmente, SOLD = vendido, PAUSED = oculto/pausado.',
  })
  @IsEnum(PRODUCT_STATUS_VALUES)
  status: ProductStatusValue;
}

