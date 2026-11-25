import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { StoreStatusDto, StoreBusinessTypeDto, STORE_PHONE_LOCAL_REGEX } from './create-store.dto';

export enum StoreSubscriptionStatusDto {
  NONE = 'NONE',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

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

  /** Parte local del teléfono (sin +222). Solo dígitos, 8-9 caracteres. Cadena vacía para borrar. */
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.phoneLocalPart !== '' && o.phoneLocalPart != null)
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

  @IsOptional()
  @IsEnum(StoreSubscriptionStatusDto)
  subscriptionStatus?: StoreSubscriptionStatusDto;
}
