import { Test, TestingModule } from '@nestjs/testing';
import { AdminAttributesController } from '../admin-attributes.controller';
import { AttributesService } from '../../../attributes/attributes.service';
import { CreateCategoryAttributeDto } from '../../../attributes/dto/create-category-attribute.dto';
import { UpdateCategoryAttributeDto } from '../../../attributes/dto/update-category-attribute.dto';
import { CreateAttributeOptionDto } from '../../../attributes/dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../../../attributes/dto/update-attribute-option.dto';
import { AttributeType } from '@prisma/client';

describe('AdminAttributesController', () => {
  let controller: AdminAttributesController;
  let attributesService: jest.Mocked<AttributesService>;

  const mockAttribute = {
    id: 1,
    categoryId: 10,
    name: 'Color',
    slug: 'color',
    type: 'SELECT' as AttributeType,
    description: null,
    isRequired: false,
    isFilterable: true,
    isSearchable: false,
    displayOrder: 0,
    options: [
      {
        id: 1,
        label: 'Red',
        value: 'red',
        displayOrder: 0,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOption = {
    id: 1,
    categoryAttributeId: 1,
    label: 'Red',
    value: 'red',
    displayOrder: 0,
    parentOptionId: null as number | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAttributesService = {
      getCategoryAttributes: jest.fn(),
      createCategoryAttribute: jest.fn(),
      updateCategoryAttribute: jest.fn(),
      reorderCategoryAttributes: jest.fn(),
      addAttributeOption: jest.fn(),
      deleteCategoryAttribute: jest.fn(),
      getAttributeOptions: jest.fn(),
      updateAttributeOption: jest.fn(),
      deleteAttributeOption: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAttributesController],
      providers: [
        { provide: AttributesService, useValue: mockAttributesService },
      ],
    }).compile();

    controller = module.get<AdminAttributesController>(
      AdminAttributesController,
    );
    attributesService = module.get(AttributesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCategoryAttributes', () => {
    it('should return attributes for a category', async () => {
      const categoryId = 10;
      attributesService.getCategoryAttributes.mockResolvedValue([
        mockAttribute,
      ] as any);

      const result = await controller.getCategoryAttributes(categoryId);

      expect(attributesService.getCategoryAttributes).toHaveBeenCalledWith(
        categoryId,
      );
      expect(result).toEqual([mockAttribute]);
    });
  });

  describe('createCategoryAttribute', () => {
    it('should create an attribute for a category', async () => {
      const categoryId = 10;
      const dto: CreateCategoryAttributeDto = {
        name: 'Color',
        type: AttributeType.SELECT,
      };
      attributesService.createCategoryAttribute.mockResolvedValue(
        mockAttribute as any,
      );

      const result = await controller.createCategoryAttribute(categoryId, dto);

      expect(attributesService.createCategoryAttribute).toHaveBeenCalledWith(
        categoryId,
        dto,
      );
      expect(result).toEqual(mockAttribute);
    });
  });

  describe('reorderCategoryAttributes', () => {
    it('should call service and return void (204 No Content)', async () => {
      const categoryId = 10;
      const items = [
        { id: 1, displayOrder: 2 },
        { id: 2, displayOrder: 0 },
      ];
      attributesService.reorderCategoryAttributes.mockResolvedValue(undefined);

      const result = await controller.reorderCategoryAttributes(categoryId, {
        items,
      });

      expect(attributesService.reorderCategoryAttributes).toHaveBeenCalledWith(
        categoryId,
        items,
      );
      expect(result).toBeUndefined();
    });
  });

  describe('updateCategoryAttribute', () => {
    it('should update an attribute', async () => {
      const attributeId = 1;
      const dto: UpdateCategoryAttributeDto = { name: 'Updated Color' };
      attributesService.updateCategoryAttribute.mockResolvedValue({
        ...mockAttribute,
        name: 'Updated Color',
      } as any);

      const result = await controller.updateCategoryAttribute(attributeId, dto);

      expect(attributesService.updateCategoryAttribute).toHaveBeenCalledWith(
        attributeId,
        dto,
      );
      expect(result).toBeDefined();
    });
  });

  describe('addAttributeOption', () => {
    it('should add an option to an attribute', async () => {
      const attributeId = 1;
      const dto: CreateAttributeOptionDto = { label: 'Red', value: 'red' };
      attributesService.addAttributeOption.mockResolvedValue(mockOption as any);

      const result = await controller.addAttributeOption(attributeId, dto);

      expect(attributesService.addAttributeOption).toHaveBeenCalledWith(
        attributeId,
        dto,
      );
      expect(result).toEqual(mockOption);
    });
  });

  describe('deleteCategoryAttribute', () => {
    it('should delete a category attribute', async () => {
      const attributeId = 1;
      attributesService.deleteCategoryAttribute.mockResolvedValue({
        deleted: true,
        id: attributeId,
      } as any);

      const result = await controller.deleteCategoryAttribute(attributeId);

      expect(attributesService.deleteCategoryAttribute).toHaveBeenCalledWith(
        attributeId,
      );
      expect(result).toEqual({ deleted: true, id: attributeId });
    });
  });

  describe('getAttributeOptions', () => {
    it('should return options for an attribute', async () => {
      const attributeId = 1;
      attributesService.getAttributeOptions.mockResolvedValue([
        mockOption,
      ] as any);

      const result = await controller.getAttributeOptions(attributeId);

      expect(attributesService.getAttributeOptions).toHaveBeenCalledWith(
        attributeId,
        undefined,
      );
      expect(result).toEqual([mockOption]);
    });

    it('should call service with parentOptionId when query param is passed', async () => {
      const attributeId = 1;
      const parentOptionId = 100;
      const filteredOptions = [
        { ...mockOption, id: 2, parentOptionId: 100, label: 'Corolla' },
      ];
      attributesService.getAttributeOptions.mockResolvedValue(
        filteredOptions as any,
      );

      const result = await controller.getAttributeOptions(
        attributeId,
        String(parentOptionId),
      );

      expect(attributesService.getAttributeOptions).toHaveBeenCalledWith(
        attributeId,
        parentOptionId,
      );
      expect(result).toEqual(filteredOptions);
      expect(result[0]).toHaveProperty('parentOptionId', 100);
    });
  });

  describe('updateAttributeOption', () => {
    it('should update an option', async () => {
      const attributeId = 1;
      const optionId = 2;
      const dto: UpdateAttributeOptionDto = { label: 'Blue', value: 'blue' };
      const updatedOption = { ...mockOption, id: optionId, ...dto };
      attributesService.updateAttributeOption.mockResolvedValue(
        updatedOption as any,
      );

      const result = await controller.updateAttributeOption(
        attributeId,
        optionId,
        dto,
      );

      expect(attributesService.updateAttributeOption).toHaveBeenCalledWith(
        attributeId,
        optionId,
        dto,
      );
      expect(result).toEqual(updatedOption);
    });
  });

  describe('deleteAttributeOption', () => {
    it('should delete an option', async () => {
      const attributeId = 1;
      const optionId = 2;
      attributesService.deleteAttributeOption.mockResolvedValue({
        deleted: true,
        id: optionId,
      } as any);

      const result = await controller.deleteAttributeOption(
        attributeId,
        optionId,
      );

      expect(attributesService.deleteAttributeOption).toHaveBeenCalledWith(
        attributeId,
        optionId,
      );
      expect(result).toEqual({ deleted: true, id: optionId });
    });
  });
});
