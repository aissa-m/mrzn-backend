import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { TransactionPartyDto } from './transaction-party.dto';

/**
 * Detalle de una transacción (compra o venta) para pantalla de detalle.
 * Extiende el shape de lista (TransactionItemDto) con productName.
 * Contrato alineado con TransactionDetailScreen en el frontend.
 *
 * productName: si el pedido tiene un solo producto se devuelve su nombre;
 * si tiene varios, se devuelve "{n} products" para mantener el payload simple
 * sin listar todos los nombres.
 */
export class TransactionDetailResponseDto {
  @ApiProperty({ description: 'ID del pedido (identificador de la transacción)' })
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

  @ApiProperty({
    description:
      'Nombre del primer producto del pedido, o "{n} products" si hay varios (ej. "2 products")',
  })
  productName: string;
}
