// src/attributes/attributes.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { PrismaService } from '../prisma/prisma.service';

/** Shape of the Prisma mock used in tests (delegate methods are Jest mocks). */
type MockPrisma = {
  $transaction: jest.Mock;
  category: { findUnique: jest.Mock };
  categoryAttribute: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  attributeOption: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  product: { findUnique: jest.Mock };
  productAttributeValue: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('AttributesService', () => {
  let service: AttributesService;
  let prisma: MockPrisma;

  const mockAttribute = {
    id: 1,
    categoryId: 10,
    name: 'Model',
    slug: 'model',
    type: 'SELECT' as const,
    categoryAttributeId: 1,
    dependsOnAttributeId: null as number | null,
  };

  const mockOption = {
    id: 1,
    categoryAttributeId: 1,
    label: 'Corolla',
    value: 'corolla',
    displayOrder: 0,
    parentOptionId: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockParentOption = {
    id: 100,
    categoryAttributeId: 2,
    label: 'Toyota',
    value: 'toyota',
    displayOrder: 0,
    parentOptionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      category: { findUnique: jest.fn() },
      categoryAttribute: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      attributeOption: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      productAttributeValue: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttributesService>(AttributesService);
    prisma = module.get(PrismaService) as unknown as MockPrisma;
    jest.clearAllMocks();
  });

  describe('getAttributeOptions', () => {
    it('returns all options when parentOptionId is not passed', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue(mockAttribute as any);
      prisma.attributeOption.findMany.mockResolvedValue([mockOption] as any);

      const result = await service.getAttributeOptions(1);

      expect(prisma.attributeOption.findMany).toHaveBeenCalledWith({
        where: { categoryAttributeId: 1 },
        orderBy: { displayOrder: 'asc' },
      });
      expect(result).toEqual([mockOption]);
      expect(result[0]).toHaveProperty('parentOptionId', 100);
    });

    it('returns only options with given parentOptionId when filter is passed', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue(mockAttribute as any);
      prisma.attributeOption.findMany.mockResolvedValue([mockOption] as any);

      const result = await service.getAttributeOptions(1, 100);

      expect(prisma.attributeOption.findMany).toHaveBeenCalledWith({
        where: { categoryAttributeId: 1, parentOptionId: 100 },
        orderBy: { displayOrder: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].parentOptionId).toBe(100);
    });

    it('throws NotFoundException when attribute does not exist', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue(null);

      await expect(service.getAttributeOptions(999)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.attributeOption.findMany).not.toHaveBeenCalled();
    });
  });

  describe('addAttributeOption with parentOptionId', () => {
    it('creates option with parentOptionId when attribute has dependsOnAttributeId and parent is valid', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue({
        ...mockAttribute,
        dependsOnAttributeId: 2,
      } as any);
      prisma.attributeOption.findUnique
        .mockResolvedValueOnce({
          ...mockParentOption,
          categoryAttributeId: 2,
          categoryAttribute: { id: 2 },
        } as any)
        .mockResolvedValueOnce(null);
      prisma.attributeOption.create.mockResolvedValue({
        ...mockOption,
        parentOptionId: 100,
      } as any);

      const result = await service.addAttributeOption(1, {
        label: 'Corolla',
        value: 'corolla',
        parentOptionId: 100,
      });

      expect(prisma.attributeOption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryAttributeId: 1,
            label: 'Corolla',
            value: 'corolla',
            parentOptionId: 100,
          }),
        }),
      );
      expect(result.parentOptionId).toBe(100);
    });

    it('throws BadRequestException when parentOptionId is set but attribute has no dependsOnAttributeId', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue(mockAttribute as any);

      await expect(
        service.addAttributeOption(1, {
          label: 'Corolla',
          value: 'corolla',
          parentOptionId: 100,
        }),
      ).rejects.toThrow(
        'Solo se puede asignar parentOptionId a opciones de un atributo que tenga dependsOnAttributeId',
      );
      expect(prisma.attributeOption.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when parentOptionId does not exist', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue({
        ...mockAttribute,
        dependsOnAttributeId: 2,
      } as any);
      prisma.attributeOption.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.addAttributeOption(1, {
          label: 'Corolla',
          value: 'corolla',
          parentOptionId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.attributeOption.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when parent option does not belong to dependsOnAttributeId', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue({
        ...mockAttribute,
        dependsOnAttributeId: 2,
      } as any);
      prisma.attributeOption.findUnique.mockResolvedValueOnce({
        ...mockParentOption,
        categoryAttributeId: 1,
        categoryAttribute: { id: 1 },
      } as any);

      await expect(
        service.addAttributeOption(1, {
          label: 'Corolla',
          value: 'corolla',
          parentOptionId: 100,
        }),
      ).rejects.toThrow(
        'La opción padre debe pertenecer al atributo del que depende este atributo',
      );
      expect(prisma.attributeOption.create).not.toHaveBeenCalled();
    });
  });

  describe('updateAttributeOption with parentOptionId', () => {
    it('throws BadRequestException when parentOptionId is self (optionId)', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue({
        dependsOnAttributeId: 2,
      } as any);
      prisma.attributeOption.findUnique.mockResolvedValue({
        id: 5,
        categoryAttributeId: 1,
      } as any);

      await expect(
        service.updateAttributeOption(1, 5, { parentOptionId: 5 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateAttributeOption(1, 5, { parentOptionId: 5 }),
      ).rejects.toThrow('no puede tener como padre a sí misma');
      expect(prisma.attributeOption.update).not.toHaveBeenCalled();
    });

    it('updates option with parentOptionId when parent is valid', async () => {
      prisma.categoryAttribute.findUnique.mockResolvedValue({
        dependsOnAttributeId: 2,
      } as any);
      prisma.attributeOption.findUnique
        .mockResolvedValueOnce({ id: 5, categoryAttributeId: 1 } as any)
        .mockResolvedValueOnce({
          ...mockParentOption,
          categoryAttributeId: 2,
          categoryAttribute: { id: 2 },
        } as any);
      prisma.attributeOption.update.mockResolvedValue({
        id: 5,
        parentOptionId: 100,
      } as any);

      const result = await service.updateAttributeOption(1, 5, {
        parentOptionId: 100,
      });

      expect(prisma.attributeOption.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ parentOptionId: 100 }),
        }),
      );
      expect(result.parentOptionId).toBe(100);
    });
  });

  describe('createCategoryAttribute with dependsOnAttributeId', () => {
    it('creates dependent attribute when parent exists and same category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 10 } as any);
      prisma.categoryAttribute.findUnique
        .mockResolvedValueOnce({ id: 2, categoryId: 10 } as any)
        .mockResolvedValueOnce(null);
      prisma.categoryAttribute.create.mockResolvedValue({
        id: 3,
        categoryId: 10,
        name: 'Model',
        slug: 'model',
        type: 'SELECT',
        dependsOnAttributeId: 2,
      } as any);

      const result = await service.createCategoryAttribute(10, {
        name: 'Model',
        type: 'SELECT',
        dependsOnAttributeId: 2,
      });

      expect(prisma.categoryAttribute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: 10,
            name: 'Model',
            type: 'SELECT',
            dependsOnAttributeId: 2,
          }),
        }),
      );
      expect(result.dependsOnAttributeId).toBe(2);
    });

    it('throws BadRequestException when dependsOnAttributeId creates a cycle', async () => {
      const existing = {
        id: 1,
        categoryId: 10,
        type: 'SELECT',
        options: [{ id: 1 }],
      };
      prisma.categoryAttribute.findUnique
        .mockResolvedValueOnce(existing as any)
        .mockResolvedValueOnce({ id: 2, categoryId: 10, dependsOnAttributeId: 1 } as any)
        .mockResolvedValueOnce({ id: 1, dependsOnAttributeId: null } as any);
      // Attribute 1 is being updated to depend on 2; 2 already depends on 1 → cycle

      await expect(
        service.updateCategoryAttribute(1, {
          dependsOnAttributeId: 2,
        }),
      ).rejects.toThrow('circular');
      expect(prisma.categoryAttribute.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when parent attribute is from another category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 10 } as any);
      prisma.categoryAttribute.findUnique.mockResolvedValueOnce({
        id: 2,
        categoryId: 99,
      } as any);

      await expect(
        service.createCategoryAttribute(10, {
          name: 'Model',
          type: 'SELECT',
          dependsOnAttributeId: 2,
        }),
      ).rejects.toThrow('misma categoría');
      expect(prisma.categoryAttribute.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when dependsOnAttributeId is set for non-SELECT/MULTISELECT', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 10 } as any);
      // validateDependsOnAttribute runs first and throws for non-SELECT

      await expect(
        service.createCategoryAttribute(10, {
          name: 'Size',
          type: 'TEXT',
          dependsOnAttributeId: 2,
        }),
      ).rejects.toThrow('SELECT o MULTISELECT');
      expect(prisma.categoryAttribute.create).not.toHaveBeenCalled();
    });
  });

  describe('setProductAttributeValues dependency validation', () => {
    const makeAttr = {
      id: 1,
      name: 'Make',
      type: 'SELECT',
      categoryId: 10,
      dependsOnAttributeId: null,
      isRequired: true,
    };
    const modelAttr = {
      id: 2,
      name: 'Model',
      type: 'SELECT',
      categoryId: 10,
      dependsOnAttributeId: 1,
      isRequired: true,
    };

    it('accepts values when child option parentOptionId matches parent selected option', async () => {
      const product = {
        id: 100,
        categoryId: 10,
        category: {
          id: 10,
          attributes: [makeAttr, modelAttr],
        },
      };
      prisma.product.findUnique.mockResolvedValue(product as any);
      prisma.attributeOption.count.mockResolvedValue(1 as any);
      prisma.attributeOption.findFirst
        .mockResolvedValueOnce({ id: 10 } as any)
        .mockResolvedValueOnce({ id: 20 } as any);
      prisma.attributeOption.findUnique.mockImplementation((args: any) => {
        if (args?.where?.id === 20) return Promise.resolve({ parentOptionId: 10 } as any);
        return Promise.resolve(null);
      });
      prisma.productAttributeValue.deleteMany.mockResolvedValue({ count: 0 } as any);
      prisma.productAttributeValue.createMany.mockResolvedValue({ count: 2 } as any);
      prisma.productAttributeValue.findMany.mockResolvedValue([] as any);

      await expect(
        service.setProductAttributeValues(100, [
          { categoryAttributeId: 1, value: 'toyota' },
          { categoryAttributeId: 2, value: 'corolla' },
        ]),
      ).resolves.toBeDefined();

      expect(prisma.productAttributeValue.createMany).toHaveBeenCalled();
    });

    it('throws ATTRIBUTE_DEPENDENCY_INVALID when child option parentOptionId does not match parent selection', async () => {
      const product = {
        id: 100,
        categoryId: 10,
        category: {
          id: 10,
          attributes: [makeAttr, modelAttr],
        },
      };
      prisma.product.findUnique.mockResolvedValue(product as any);
      prisma.attributeOption.count.mockResolvedValue(1 as any);
      prisma.attributeOption.findFirst
        .mockResolvedValueOnce({ id: 10 } as any)
        .mockResolvedValueOnce({ id: 20 } as any);
      prisma.attributeOption.findUnique.mockImplementation((args: any) => {
        if (args?.where?.id === 20) {
          return Promise.resolve({ id: 20, parentOptionId: 99 } as any);
        }
        return Promise.resolve(null);
      });
      prisma.productAttributeValue.deleteMany.mockResolvedValue({ count: 0 } as any);

      await expect(
        service.setProductAttributeValues(100, [
          { categoryAttributeId: 1, value: 'toyota' },
          { categoryAttributeId: 2, value: 'corolla' },
        ]),
      ).rejects.toMatchObject({
        response: { code: 'ATTRIBUTE_DEPENDENCY_INVALID' },
      });
      expect(prisma.productAttributeValue.createMany).not.toHaveBeenCalled();
    });
  });

  describe('reorderCategoryAttributes', () => {
    const categoryId = 10;
    const validItems = [
      { id: 1, displayOrder: 2 },
      { id: 2, displayOrder: 0 },
      { id: 3, displayOrder: 1 },
    ];

    it('updates displayOrder in a single transaction when reorder is valid', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId } as any);
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { id: 1, categoryId },
        { id: 2, categoryId },
        { id: 3, categoryId },
      ] as any);
      prisma.categoryAttribute.update.mockResolvedValue({} as any);

      await service.reorderCategoryAttributes(categoryId, validItems);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
      expect(prisma.categoryAttribute.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        select: { id: true, categoryId: true },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txCalls = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      expect(txCalls).toHaveLength(3);
      await Promise.all(txCalls);
      expect(prisma.categoryAttribute.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { displayOrder: 2 },
      });
      expect(prisma.categoryAttribute.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { displayOrder: 0 },
      });
      expect(prisma.categoryAttribute.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { displayOrder: 1 },
      });
    });

    it('throws BadRequestException when an id does not belong to the category', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId } as any);
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { id: 1, categoryId },
        { id: 2, categoryId: 99 },
        { id: 3, categoryId },
      ] as any);

      await expect(
        service.reorderCategoryAttributes(categoryId, validItems),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when there are duplicate ids', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId } as any);

      await expect(
        service.reorderCategoryAttributes(categoryId, [
          { id: 1, displayOrder: 0 },
          { id: 1, displayOrder: 1 },
        ]),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.categoryAttribute.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns without running transaction when items is empty', async () => {
      await service.reorderCategoryAttributes(categoryId, []);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.reorderCategoryAttributes(categoryId, validItems),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.categoryAttribute.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when an attribute id does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId } as any);
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { id: 1, categoryId },
        { id: 3, categoryId },
      ] as any);

      await expect(
        service.reorderCategoryAttributes(categoryId, validItems),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
