import {
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  Matches,
  MinLength,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Gender } from '@prisma/client';
import { IsEmailWithCode } from '../../common/validators/email-with-code.validator';

const MAX_NAME = 80;
const MAX_ADDRESS = 200;
const MAX_CITY_REGION = 100;
const MAX_POSTAL = 20;
const MAX_COUNTRY = 100;
const NNI_MIN = 5;
const NNI_MAX = 30;
const NNI_PATTERN = /^[A-Za-z0-9]+$/;

/** No permite actualizar role, phone ni id. Solo datos editables del perfil. */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  lastName?: string;

  @IsOptional()
  @IsEmailWithCode()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(NNI_MIN)
  @MaxLength(NNI_MAX)
  @Matches(NNI_PATTERN, {
    message: 'nni must be alphanumeric',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  nni?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADDRESS)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADDRESS)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CITY_REGION)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_CITY_REGION)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_POSTAL)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_COUNTRY)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  country?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string; // ISO date string

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
