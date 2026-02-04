import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { StoreStatusDto } from './create-store.dto';

export class UpdateStoreDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

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
