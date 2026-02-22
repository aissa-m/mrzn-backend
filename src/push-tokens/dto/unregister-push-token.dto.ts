import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class UnregisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'Token inválido' })
  @MaxLength(2048)
  token!: string;
}
