import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStoreDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;
}
