import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Respuesta ligera de GET /users/me/profile para la pantalla principal de perfil.
 * Sin datos sensibles (phone, nni, address, birthDate, gender).
 * rating y reviewsCount preparados para futuro modelo Review.
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

  @ApiProperty({ enum: Role })
  role: Role;

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
