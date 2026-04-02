import { ApiProperty } from '@nestjs/swagger';
import { Role, SellerMode } from '@prisma/client';

/**
 * Respuesta ligera de GET /users/me/profile para la pantalla principal de perfil.
 * Incluye phone del propio usuario (JWT); el resto de datos sensibles omitidos aquí siguen siendo nni, domicilio, birthDate, gender.
 * rating y reviewsCount preparados para futuro modelo Review.
 * sellerMode, store y canPublishAsStore para flujos de venta (PERSONAL vs STORE).
 */
export class MeProfileResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ nullable: true })
  name: string | null;

  @ApiProperty({ nullable: true })
  firstName: string | null;

  @ApiProperty({ nullable: true })
  lastName: string | null;

  @ApiProperty({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Teléfono de la cuenta (trim). Solo visible para el usuario autenticado en este endpoint.',
  })
  phone: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ enum: SellerMode, description: 'Modo de venta: PERSONAL o STORE' })
  sellerMode: SellerMode;

  @ApiProperty({
    nullable: true,
    description: 'Su única tienda (id, name, status, subscriptionStatus) si tiene',
  })
  store: {
    id: number;
    name: string;
    status: string;
    subscriptionStatus: string;
  } | null;

  @ApiProperty({ description: 'Si puede publicar productos como tienda (tienda activa + plan)' })
  canPublishAsStore: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ description: 'Número de productos publicados por el usuario' })
  productsCount: number;

  @ApiProperty({ description: 'Número de pedidos recibidos (ventas en tiendas del usuario)' })
  salesCount: number;

  @ApiProperty({ description: 'Número de pedidos realizados por el usuario' })
  purchasesCount: number;

  @ApiProperty({ nullable: true, description: 'Valoración media (null hasta que exista modelo Review)' })
  rating: number | null;

  @ApiProperty({ description: 'Número de reseñas (0 hasta que exista modelo Review)' })
  reviewsCount: number;
}
