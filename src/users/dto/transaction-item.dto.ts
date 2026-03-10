import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { TransactionPartyDto } from './transaction-party.dto';

/**
 * Item de lista de transacciones (compras o ventas) optimizado para móvil.
 * Incluye resumen del pedido y del otro participante (vendedor en compras, comprador en ventas).
 */
export class TransactionItemDto {
  @ApiProperty({ description: 'ID del pedido' })
  orderId: number;

  @ApiProperty({
    enum: OrderStatus,
    description: 'Estado interno del pedido (PENDING, PAID, SHIPPED, COMPLETED, CANCELED)',
  })
  status: OrderStatus;

  @ApiProperty({
    enum: ['in_progress', 'completed'],
    description:
      'Agrupación para la app: in_progress = PENDING/PAID/SHIPPED, completed = COMPLETED/CANCELED',
  })
  transactionStatus: 'in_progress' | 'completed';

  @ApiProperty({ description: 'Fecha de creación del pedido' })
  createdAt: Date;

  @ApiProperty({ description: 'Total del pedido (importe)' })
  totalAmount: number;

  @ApiProperty({ description: 'Número de líneas/productos en el pedido' })
  productCount: number;

  @ApiProperty({
    description: 'Resumen del otro participante: vendedor en compras, comprador en ventas',
  })
  otherParty: TransactionPartyDto;

  @ApiPropertyOptional({
    description:
      'Miniatura representativa del pedido (primera imagen del primer producto). Null si no hay imágenes.',
    nullable: true,
  })
  thumbnailUrl: string | null;
}
