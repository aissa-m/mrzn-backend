import { ApiProperty } from '@nestjs/swagger';
import { TransactionItemDto } from './transaction-item.dto';

/**
 * Payload paginado para listas de compras o ventas del usuario.
 * Estructura lista para pantallas "Purchases" y "Sales" en la app móvil.
 */
export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [TransactionItemDto] })
  items: TransactionItemDto[];

  @ApiProperty({ description: 'Total de registros que cumplen el filtro' })
  total: number;

  @ApiProperty({ description: 'Página actual (1-based)' })
  page: number;

  @ApiProperty({ description: 'Tamaño de página solicitado' })
  limit: number;

  @ApiProperty({ description: 'Número total de páginas' })
  pages: number;
}
