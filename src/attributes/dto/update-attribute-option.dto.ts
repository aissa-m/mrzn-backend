import { IsString, IsOptional, IsInt } from 'class-validator';

export class UpdateAttributeOptionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
