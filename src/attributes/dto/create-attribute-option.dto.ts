// src/attributes/dto/create-attribute-option.dto.ts
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateAttributeOptionDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

