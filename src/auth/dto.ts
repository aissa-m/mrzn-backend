import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsNotEmpty() name: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsEmail() email: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @MinLength(6) password: string;
}
export class LoginDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @IsEmail() email: string;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @MinLength(6) password: string;
}
