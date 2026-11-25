import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum StoreStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

/** Tipo de negocio de la tienda (onboarding). */
export enum StoreBusinessTypeDto {
  SUPERMARKET = 'SUPERMARKET',
  PHARMACY = 'PHARMACY',
  FASHION = 'FASHION',
  ELECTRONICS = 'ELECTRONICS',
  RESTAURANT = 'RESTAURANT',
  SERVICES = 'SERVICES',
  AUTOMOTIVE = 'AUTOMOTIVE',
  OTHER = 'OTHER',
}

/**
 * Parte local del teléfono de tienda (sin prefijo).
 * Backend normaliza a +222 + este valor. Solo dígitos; Mauritania suele 8 dígitos.
 */
export const STORE_PHONE_LOCAL_REGEX = /^[0-9]{8,9}$/;

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(StoreBusinessTypeDto)
  businessType?: StoreBusinessTypeDto;

  @IsOptional()
  @IsString()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  bannerUrl?: string;

  /** Parte local del teléfono (sin +222). Solo dígitos, 8-9 caracteres. Backend guarda +222 + este valor. */
  @IsOptional()
  @IsString()
  @Matches(STORE_PHONE_LOCAL_REGEX, {
    message: 'El teléfono debe ser 8 o 9 dígitos (parte local Mauritania, sin +222)',
  })
  phoneLocalPart?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  regionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  regionName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  departmentCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  // --- Campos legacy/deprecated: no usar en flujo visible de onboarding ---
  @IsOptional()
  @IsString()
  @IsUrl()
  logoImageUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  facebookUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  instagramUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  twitterUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  tiktokUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  websiteUrl?: string;

  @IsOptional()
  @IsEnum(StoreStatusDto)
  status?: StoreStatusDto;
}
