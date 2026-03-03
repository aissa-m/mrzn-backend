import { IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAttributeOptionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  /** Opción padre para selects dependientes. Null para opción independiente. */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentOptionId?: number | null;
}
