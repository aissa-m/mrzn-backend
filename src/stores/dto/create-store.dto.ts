import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export enum StoreStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
}

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
  @IsString()
  @IsUrl()
  logoImageUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

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
