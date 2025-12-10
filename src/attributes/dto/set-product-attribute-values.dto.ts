// src/attributes/dto/set-product-attribute-values.dto.ts
import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductAttributeValueDto {
  @IsInt()
  categoryAttributeId: number;

  @IsString()
  value: string;
}

export class SetProductAttributeValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  values: ProductAttributeValueDto[];
}

