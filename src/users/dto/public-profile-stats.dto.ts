import { ApiProperty } from '@nestjs/swagger';

/**
 * Estadísticas del perfil público.
 * productsCount, salesCount, purchasesCount provienen de la misma lógica que /users/me/profile.
 *
 * Campos preparados para futuro (no existen aún en BD; se devuelven como null):
 * - lastActiveAt: última actividad del usuario
 * - responseTime: tiempo medio de respuesta (ej. en conversaciones)
 * - responseRate: porcentaje de respuestas
 */
export class PublicProfileStatsDto {
  @ApiProperty({ description: 'Número de productos publicados por el usuario' })
  productsCount: number;

  @ApiProperty({ description: 'Número de pedidos recibidos (ventas en tiendas del usuario)' })
  salesCount: number;

  @ApiProperty({ description: 'Número de pedidos realizados por el usuario' })
  purchasesCount: number;

  @ApiProperty({
    nullable: true,
    description: 'Última actividad (null: no implementado en BD aún)',
  })
  lastActiveAt: Date | null;

  @ApiProperty({
    nullable: true,
    description: 'Tiempo medio de respuesta en conversaciones (null: no implementado en BD aún)',
  })
  responseTime: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Porcentaje de respuestas (null: no implementado en BD aún)',
  })
  responseRate: number | null;
}
