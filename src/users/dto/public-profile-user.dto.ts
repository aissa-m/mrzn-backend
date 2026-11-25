import { ApiProperty } from '@nestjs/swagger';

/**
 * Datos básicos del usuario para la vista "mi perfil público".
 * Sin datos sensibles (email, phone, nni, dirección, birthDate).
 * rating y reviewsCount preparados para futuro modelo Review.
 */
export class PublicProfileUserDto {
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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true, description: 'Valoración media (null hasta que exista modelo Review)' })
  rating: number | null;

  @ApiProperty({ description: 'Número de reseñas (0 hasta que exista modelo Review)' })
  reviewsCount: number;
}
