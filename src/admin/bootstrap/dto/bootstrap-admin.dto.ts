import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class BootstrapAdminDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(200)
  name!: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  @IsNotEmpty({ message: 'email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;
}
