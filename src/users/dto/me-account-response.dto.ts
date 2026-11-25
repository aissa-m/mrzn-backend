import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Role, SellerMode, StoreStatus, StoreSubscriptionStatus } from '@prisma/client';

/** Resumen de tienda en GET /users/me (misma forma que SellerStoreInfo). */
export class MeAccountStoreDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: StoreStatus })
  status: StoreStatus;

  @ApiProperty({ enum: StoreSubscriptionStatus })
  subscriptionStatus: StoreSubscriptionStatus;
}

/**
 * Cuerpo de GET /users/me (y respuestas PATCH/Clear avatar que usan el mismo select).
 * Solo el propio usuario autenticado recibe estos datos (JwtAuthGuard).
 */
export class MeAccountResponseDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Teléfono de la cuenta (p. ej. login OTP). String recortado (trim); null si no hay teléfono vinculado.',
  })
  phone: string | null;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiPropertyOptional({ nullable: true })
  firstName: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastName: string | null;

  @ApiPropertyOptional({ nullable: true })
  nni: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine1: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine2: string | null;

  @ApiPropertyOptional({ nullable: true })
  city: string | null;

  @ApiPropertyOptional({ nullable: true })
  region: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  country: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  birthDate: Date | null;

  @ApiPropertyOptional({ enum: Gender, nullable: true })
  gender: Gender | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ enum: SellerMode })
  sellerMode: SellerMode;

  @ApiProperty({ description: 'Tiendas del usuario (relación Prisma); puede estar vacío', isArray: true, type: Object })
  stores: unknown[];

  @ApiPropertyOptional({
    nullable: true,
    type: MeAccountStoreDto,
    description: 'Última tienda del vendedor (resumen); ver también stores',
  })
  store: MeAccountStoreDto | null;

  @ApiProperty({ description: 'Tienda activa con plan de publicación como tienda' })
  canPublishAsStore: boolean;
}
