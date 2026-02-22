import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsIn,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty() name: string;
  @IsEmail() email: string;
  @MinLength(6) password: string;
}
export class LoginDto {
  @IsEmail() email: string;
  @MinLength(6) password: string;
}

/** Teléfono: solo dígitos y +, longitud razonable (ej. E.164) */
const PHONE_PATTERN = /^\+?[0-9]{8,20}$/;

export class OtpRequestDto {
  @IsNotEmpty()
  @Matches(PHONE_PATTERN, {
    message: 'phone must contain only digits and optional +, 8-20 chars',
  })
  @MaxLength(20)
  phone: string;

  @IsIn(['USER', 'STORE_OWNER'])
  desiredRole: 'USER' | 'STORE_OWNER';
}

export class OtpVerifyDto {
  @IsNotEmpty()
  @Matches(PHONE_PATTERN, {
    message: 'phone must contain only digits and optional +, 8-20 chars',
  })
  @MaxLength(20)
  phone: string;

  @IsNotEmpty()
  @Matches(/^[0-9]{6}$/, { message: 'code must be 6 digits' })
  code: string;

  @IsIn(['USER', 'STORE_OWNER'])
  desiredRole: 'USER' | 'STORE_OWNER';
}
