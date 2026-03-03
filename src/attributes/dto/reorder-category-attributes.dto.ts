import { IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderCategoryAttributeItemDto {
  @IsInt()
  @Type(() => Number)
  id: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  displayOrder: number;
}

export class ReorderCategoryAttributesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryAttributeItemDto)
  items: ReorderCategoryAttributeItemDto[];
}
