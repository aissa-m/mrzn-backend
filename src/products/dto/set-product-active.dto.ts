import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Body para PATCH /api/products/:id/active.
 * Solo cambia la visibilidad del producto (isActive); no modifica otros datos.
 */
export class SetProductActiveDto {
  @ApiProperty({ description: 'true = visible en marketplace, false = pausado/oculto' })
  @IsBoolean()
  active: boolean;
}
