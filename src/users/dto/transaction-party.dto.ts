import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Resumen del "otro lado" de la transacción: vendedor en compras, comprador en ventas.
 * Solo datos necesarios para lista en móvil (nombre y avatar).
 */
export class TransactionPartyDto {
  @ApiProperty({ description: 'ID del usuario (vendedor o comprador)' })
  id: number;

  @ApiProperty({
    description: 'Nombre para mostrar (name o firstName + lastName o "Usuario")',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'URL del avatar si existe',
    nullable: true,
  })
  avatarUrl: string | null;
}
