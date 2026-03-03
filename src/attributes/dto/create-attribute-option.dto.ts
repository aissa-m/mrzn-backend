// src/attributes/dto/create-attribute-option.dto.ts
import { IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAttributeOptionDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  /** Opción padre para selects dependientes (ej. Model → Make). Debe ser de otro atributo. */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentOptionId?: number;
}

