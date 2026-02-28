// src/attributes/attributes.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, AttributeType } from '@prisma/client';

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normaliza un slug o valor a minúsculas y sin espacios sobrantes
   * Esto evita duplicados lógicos como "Red" vs "red" o "Red " vs "Red"
   */
  private normalizeSlugOrValue(input: string): string {
    return input.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Genera un slug URL-friendly a partir de un nombre
   */
  private generateSlug(name: string): string {
    return this.normalizeSlugOrValue(name)
      .replace(/[^a-z0-9]+/g, '-') // Reemplaza caracteres especiales con guiones
      .replace(/^-+|-+$/g, '') // Elimina guiones al inicio y final
      .substring(0, 100); // Limita la longitud
  }

  /**
   * Valida que un atributo de tipo SELECT o MULTISELECT tenga al menos una opción
   */
  private async validateAttributeOptions(
    categoryAttributeId: number,
    type: AttributeType,
  ): Promise<void> {
    if (type === 'SELECT' || type === 'MULTISELECT') {
      const optionCount = await this.prisma.attributeOption.count({
        where: { categoryAttributeId },
      });

      if (optionCount === 0) {
        throw new BadRequestException(
          `Los atributos de tipo ${type} deben tener al menos una opción definida`,
        );
      }
    }
  }

  /**
   * Valida los rangos numéricos (minValue ≤ maxValue)
   */
  private validateNumericRanges(
    type: AttributeType,
    minValue: number | null | undefined,
    maxValue: number | null | undefined,
  ): void {
    if (type !== 'NUMBER') {
      return;
    }

    if (minValue !== null && minValue !== undefined && maxValue !== null && maxValue !== undefined) {
      if (minValue > maxValue) {
        throw new BadRequestException(
          `minValue (${minValue}) debe ser menor o igual a maxValue (${maxValue})`,
        );
      }
    }
  }

  /**
   * Valida la coherencia de unit, group y rawJson según el tipo de atributo
   */
  private validateAttributeCoherence(
    attribute: any,
    rawJson: any,
  ): void {
    // rawJson debe ser null para SELECT/MULTISELECT (usan attributeOptionId)
    if ((attribute.type === 'SELECT' || attribute.type === 'MULTISELECT') && rawJson !== null) {
      throw new BadRequestException(
        `Los atributos de tipo ${attribute.type} no deben tener rawJson. Deben usar attributeOptionId.`,
      );
    }

    // rawJson debe estar presente para NUMBER, BOOLEAN, DATE para optimizar filtros
    // Pero no es un error estricto si falta, solo una advertencia implícita
    // La validación se hace en parseAndValidateValue que siempre genera rawJson para estos tipos
  }

  /**
   * Valida que un valor coincida con una opción válida para atributos SELECT/MULTISELECT
   */
  private async validateValueAgainstOptions(
    categoryAttributeId: number,
    value: string,
    type: AttributeType,
  ): Promise<number | null> {
    // Solo validar para SELECT y MULTISELECT
    if (type !== 'SELECT' && type !== 'MULTISELECT') {
      return null;
    }

    const normalizedValue = this.normalizeSlugOrValue(value);

    const option = await this.prisma.attributeOption.findFirst({
      where: {
        categoryAttributeId,
        value: normalizedValue,
      },
    });

    if (!option) {
      throw new BadRequestException(
        `El valor "${value}" no coincide con ninguna opción válida para este atributo`,
      );
    }

    return option.id;
  }

  /**
   * Valida un valor numérico contra minValue y maxValue
   */
  private validateNumericRange(
    value: number,
    minValue: number | null,
    maxValue: number | null,
  ): void {
    if (minValue !== null && value < minValue) {
      throw new BadRequestException(
        `El valor debe ser mayor o igual a ${minValue}`,
      );
    }

    if (maxValue !== null && value > maxValue) {
      throw new BadRequestException(
        `El valor debe ser menor o igual a ${maxValue}`,
      );
    }
  }

  /**
   * Parsea y valida un valor según el tipo de atributo
   */
  private async parseAndValidateValue(
    categoryAttributeId: number,
    value: string,
    type: AttributeType,
    minValue?: number | null,
    maxValue?: number | null,
  ): Promise<{ value: string; rawJson: any; attributeOptionId: number | null }> {
    const normalizedValue = this.normalizeSlugOrValue(value);
    let parsedValue: any = null;
    let attributeOptionId: number | null = null;

    switch (type) {
      case 'NUMBER': {
        const numValue = parseFloat(normalizedValue);
        if (isNaN(numValue)) {
          throw new BadRequestException('El valor debe ser un número válido');
        }
        this.validateNumericRange(numValue, minValue ?? null, maxValue ?? null);
        parsedValue = { number: numValue };
        break;
      }

      case 'BOOLEAN': {
        const boolValue = normalizedValue === 'true' || normalizedValue === '1';
        parsedValue = { boolean: boolValue };
        break;
      }

      case 'DATE': {
        const dateValue = new Date(normalizedValue);
        if (isNaN(dateValue.getTime())) {
          throw new BadRequestException('El valor debe ser una fecha válida');
        }
        parsedValue = { date: dateValue.toISOString() };
        break;
      }

      case 'SELECT':
      case 'MULTISELECT': {
        attributeOptionId = await this.validateValueAgainstOptions(
          categoryAttributeId,
          normalizedValue,
          type,
        );
        // Para SELECT/MULTISELECT no usamos rawJson
        parsedValue = null;
        break;
      }

      case 'TEXT':
      case 'URL':
      default:
        // Para TEXT y URL, no parseamos a JSON
        parsedValue = null;
        break;
    }

    return {
      value: normalizedValue,
      rawJson: parsedValue,
      attributeOptionId,
    };
  }

  /**
   * Valida dependsOnAttributeId: padre existe, misma categoría, no ciclos, solo SELECT/MULTISELECT.
   * @param categoryId Categoría del atributo
   * @param dependsOnAttributeId ID del atributo padre
   * @param type Tipo del atributo actual
   * @param attributeId Opcional: ID del atributo actual (para update: evita self y ciclos)
   */
  private async validateDependsOnAttribute(
    categoryId: number,
    dependsOnAttributeId: number,
    type: AttributeType,
    attributeId?: number,
  ): Promise<void> {
    if (type !== 'SELECT' && type !== 'MULTISELECT') {
      throw new BadRequestException(
        'dependsOnAttributeId solo está permitido para atributos de tipo SELECT o MULTISELECT',
      );
    }

    if (attributeId !== undefined && dependsOnAttributeId === attributeId) {
      throw new BadRequestException(
        'Un atributo no puede depender de sí mismo',
      );
    }

    const parent = await this.prisma.categoryAttribute.findUnique({
      where: { id: dependsOnAttributeId },
    });

    if (!parent) {
      throw new NotFoundException('El atributo padre no existe');
    }

    if (parent.categoryId !== categoryId) {
      throw new BadRequestException(
        'El atributo padre debe pertenecer a la misma categoría',
      );
    }

    if (attributeId !== undefined) {
      let current: { id: number; dependsOnAttributeId: number | null } | null =
        await this.prisma.categoryAttribute.findUnique({
          where: { id: dependsOnAttributeId },
          select: { id: true, dependsOnAttributeId: true },
        });
      const visited = new Set<number>();
      while (current) {
        if (current.id === attributeId) {
          throw new BadRequestException(
            'No se puede crear una dependencia circular entre atributos',
          );
        }
        if (visited.has(current.id)) break;
        visited.add(current.id);
        if (current.dependsOnAttributeId == null) break;
        current = await this.prisma.categoryAttribute.findUnique({
          where: { id: current.dependsOnAttributeId },
          select: { id: true, dependsOnAttributeId: true },
        });
      }
    }
  }

  /**
   * Crea un atributo para una categoría
   */
  async createCategoryAttribute(
    categoryId: number,
    data: {
      name: string;
      type: AttributeType;
      description?: string;
      isRequired?: boolean;
      isFilterable?: boolean;
      isSearchable?: boolean;
      displayOrder?: number;
      unit?: string;
      group?: string;
      minValue?: number;
      maxValue?: number;
      dependsOnAttributeId?: number;
    },
  ) {
    // Verificar que la categoría existe
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    // Validar que minValue y maxValue solo se usen con tipo NUMBER
    if (data.type !== 'NUMBER' && (data.minValue !== undefined || data.maxValue !== undefined)) {
      throw new BadRequestException(
        'Los campos minValue y maxValue solo están permitidos para atributos de tipo NUMBER',
      );
    }

    if (data.dependsOnAttributeId != null) {
      await this.validateDependsOnAttribute(
        categoryId,
        data.dependsOnAttributeId,
        data.type,
      );
    }

    // Validar rangos numéricos (minValue ≤ maxValue)
    this.validateNumericRanges(
      data.type,
      data.minValue,
      data.maxValue,
    );

    // Normalizar slug
    const slug = this.generateSlug(data.name);

    // Verificar unicidad del slug en la categoría
    const existing = await this.prisma.categoryAttribute.findUnique({
      where: {
        categoryId_slug: {
          categoryId,
          slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un atributo con el slug "${slug}" en esta categoría`,
      );
    }

    // Crear el atributo
    const attribute = await this.prisma.categoryAttribute.create({
      data: {
        categoryId,
        name: data.name,
        slug,
        type: data.type,
        description: data.description,
        isRequired: data.isRequired ?? false,
        isFilterable: data.isFilterable ?? true,
        isSearchable: data.isSearchable ?? false,
        displayOrder: data.displayOrder ?? 0,
        unit: data.unit,
        group: data.group,
        minValue: data.type === 'NUMBER' ? data.minValue : null,
        maxValue: data.type === 'NUMBER' ? data.maxValue : null,
        dependsOnAttributeId: data.dependsOnAttributeId ?? undefined,
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // Validar que SELECT/MULTISELECT tengan opciones (después de crear)
    // Nota: Esto permite crear el atributo primero y luego añadir opciones,
    // pero valida antes de permitir usarlo en productos
    if (attribute.type === 'SELECT' || attribute.type === 'MULTISELECT') {
      // No lanzamos error aquí, pero el atributo no podrá usarse hasta tener opciones
      // La validación se hará cuando se intente usar en setProductAttributeValues
    }

    return attribute;
  }

  /**
   * Actualiza un atributo de categoría
   */
  async updateCategoryAttribute(
    categoryAttributeId: number,
    data: {
      name?: string;
      type?: AttributeType;
      description?: string;
      isRequired?: boolean;
      isFilterable?: boolean;
      isSearchable?: boolean;
      displayOrder?: number;
      unit?: string;
      group?: string;
      minValue?: number | null;
      maxValue?: number | null;
      dependsOnAttributeId?: number | null;
    },
  ) {
    // Verificar que el atributo existe
    const existing = await this.prisma.categoryAttribute.findUnique({
      where: { id: categoryAttributeId },
      include: {
        options: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Atributo no encontrado');
    }

    // Determinar el tipo final (el existente o el nuevo)
    const finalType = data.type ?? existing.type;

    if (data.dependsOnAttributeId !== undefined) {
      const depId =
        data.dependsOnAttributeId === null ? undefined : data.dependsOnAttributeId;
      if (depId != null) {
        await this.validateDependsOnAttribute(
          existing.categoryId,
          depId,
          finalType,
          categoryAttributeId,
        );
      }
    }

    // Validar que minValue y maxValue solo se usen con tipo NUMBER
    if (finalType !== 'NUMBER' && (data.minValue !== undefined || data.maxValue !== undefined)) {
      throw new BadRequestException(
        'Los campos minValue y maxValue solo están permitidos para atributos de tipo NUMBER',
      );
    }

    // Validar rangos numéricos
    const finalMinValue = data.minValue !== undefined ? data.minValue : existing.minValue;
    const finalMaxValue = data.maxValue !== undefined ? data.maxValue : existing.maxValue;
    this.validateNumericRanges(finalType, finalMinValue, finalMaxValue);

    // Si se cambia el tipo a SELECT/MULTISELECT, validar que tenga opciones
    if (
      (finalType === 'SELECT' || finalType === 'MULTISELECT') &&
      existing.options.length === 0
    ) {
      throw new BadRequestException(
        `No se puede cambiar el tipo a ${finalType} sin opciones definidas. Añade al menos una opción primero.`,
      );
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      const newSlug = this.generateSlug(data.name);
      
      // Validar que el nuevo slug no esté duplicado en la misma categoría
      const existingWithSlug = await this.prisma.categoryAttribute.findUnique({
        where: {
          categoryId_slug: {
            categoryId: existing.categoryId,
            slug: newSlug,
          },
        },
      });

      // Si existe otro atributo (diferente al actual) con el mismo slug, lanzar error
      if (existingWithSlug && existingWithSlug.id !== categoryAttributeId) {
        throw new ConflictException(
          `Ya existe un atributo con el slug "${newSlug}" en esta categoría`,
        );
      }

      updateData.slug = newSlug;
    }
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
    if (data.isFilterable !== undefined) updateData.isFilterable = data.isFilterable;
    if (data.isSearchable !== undefined) updateData.isSearchable = data.isSearchable;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.group !== undefined) updateData.group = data.group;
    if (data.minValue !== undefined) {
      updateData.minValue = finalType === 'NUMBER' ? data.minValue : null;
    }
    if (data.maxValue !== undefined) {
      updateData.maxValue = finalType === 'NUMBER' ? data.maxValue : null;
    }
    if (data.dependsOnAttributeId !== undefined) {
      updateData.dependsOnAttributeId = data.dependsOnAttributeId;
    }

    // Actualizar el atributo
    const updated = await this.prisma.categoryAttribute.update({
      where: { id: categoryAttributeId },
      data: updateData,
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return updated;
  }

  /**
   * Valida parentOptionId para opciones dependientes: existe, pertenece al atributo dependsOnAttributeId, no ciclos.
   * El atributo debe tener dependsOnAttributeId; la opción padre debe ser de ese atributo.
   */
  private async validateParentOptionForOption(
    attributeId: number,
    dependsOnAttributeId: number,
    parentOptionId: number,
    optionId?: number,
  ): Promise<void> {
    if (optionId !== undefined && parentOptionId === optionId) {
      throw new BadRequestException(
        'Una opción no puede tener como padre a sí misma',
      );
    }

    const parent = await this.prisma.attributeOption.findUnique({
      where: { id: parentOptionId },
      include: { categoryAttribute: true },
    });

    if (!parent) {
      throw new NotFoundException('La opción padre no existe');
    }

    if (parent.categoryAttributeId !== dependsOnAttributeId) {
      throw new BadRequestException(
        'La opción padre debe pertenecer al atributo del que depende este atributo (dependsOnAttributeId)',
      );
    }
  }

  /**
   * Añade una opción a un atributo
   */
  async addAttributeOption(
    categoryAttributeId: number,
    data: {
      label: string;
      value?: string;
      displayOrder?: number;
      parentOptionId?: number;
    },
  ) {
    // Verificar que el atributo existe
    const attribute = await this.prisma.categoryAttribute.findUnique({
      where: { id: categoryAttributeId },
    });

    if (!attribute) {
      throw new NotFoundException('Atributo no encontrado');
    }

    // Validar que el atributo sea de tipo SELECT o MULTISELECT
    if (attribute.type !== 'SELECT' && attribute.type !== 'MULTISELECT') {
      throw new BadRequestException(
        'Solo los atributos de tipo SELECT y MULTISELECT pueden tener opciones',
      );
    }

    if (data.parentOptionId != null) {
      if (attribute.dependsOnAttributeId == null) {
        throw new BadRequestException(
          'Solo se puede asignar parentOptionId a opciones de un atributo que tenga dependsOnAttributeId',
        );
      }
      await this.validateParentOptionForOption(
        categoryAttributeId,
        attribute.dependsOnAttributeId,
        data.parentOptionId,
      );
    }

    // Normalizar el valor (usar label si no se proporciona value)
    const normalizedValue = this.normalizeSlugOrValue(
      data.value || data.label,
    );

    // Verificar unicidad del valor en el atributo
    const existing = await this.prisma.attributeOption.findUnique({
      where: {
        categoryAttributeId_value: {
          categoryAttributeId,
          value: normalizedValue,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una opción con el valor "${normalizedValue}" para este atributo`,
      );
    }

    // Crear la opción
    const option = await this.prisma.attributeOption.create({
      data: {
        categoryAttributeId,
        label: data.label,
        value: normalizedValue,
        displayOrder: data.displayOrder ?? 0,
        parentOptionId: data.parentOptionId ?? undefined,
      },
    });

    return option;
  }

  /**
   * Elimina un atributo de categoría (y sus opciones por cascade)
   */
  async deleteCategoryAttribute(attributeId: number) {
    const attribute = await this.prisma.categoryAttribute.findUnique({
      where: { id: attributeId },
      include: {
        options: true,
      },
    });

    if (!attribute) {
      throw new NotFoundException('Atributo no encontrado');
    }

    await this.prisma.categoryAttribute.delete({
      where: { id: attributeId },
    });

    return { deleted: true, id: attributeId };
  }

  /**
   * Lista las opciones de un atributo. Si se pasa parentOptionId, solo devuelve opciones hijas de esa opción (selects dependientes).
   */
  async getAttributeOptions(attributeId: number, parentOptionId?: number) {
    const attribute = await this.prisma.categoryAttribute.findUnique({
      where: { id: attributeId },
    });

    if (!attribute) {
      throw new NotFoundException('Atributo no encontrado');
    }

    const where: { categoryAttributeId: number; parentOptionId?: number | null } =
      { categoryAttributeId: attributeId };

    if (parentOptionId !== undefined && parentOptionId !== null) {
      where.parentOptionId = parentOptionId;
    }

    return this.prisma.attributeOption.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Actualiza una opción de un atributo (verifica que la opción pertenezca al atributo)
   */
  async updateAttributeOption(
    attributeId: number,
    optionId: number,
    data: {
      label?: string;
      value?: string;
      displayOrder?: number;
      parentOptionId?: number | null;
    },
  ) {
    const option = await this.prisma.attributeOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      throw new NotFoundException('Opción no encontrada');
    }

    if (option.categoryAttributeId !== attributeId) {
      throw new NotFoundException(
        'La opción no pertenece al atributo indicado',
      );
    }

    const attributeWithDep = await this.prisma.categoryAttribute.findUnique({
      where: { id: attributeId },
      select: { dependsOnAttributeId: true },
    });
    if (data.parentOptionId !== undefined) {
      if (data.parentOptionId != null) {
        if (attributeWithDep?.dependsOnAttributeId == null) {
          throw new BadRequestException(
            'Solo se puede asignar parentOptionId a opciones de un atributo que tenga dependsOnAttributeId',
          );
        }
        await this.validateParentOptionForOption(
          attributeId,
          attributeWithDep!.dependsOnAttributeId!,
          data.parentOptionId,
          optionId,
        );
      }
    }

    const updateData: {
      label?: string;
      value?: string;
      displayOrder?: number;
      parentOptionId?: number | null;
    } = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.displayOrder !== undefined)
      updateData.displayOrder = data.displayOrder;
    if (data.parentOptionId !== undefined)
      updateData.parentOptionId = data.parentOptionId;

    if (data.value !== undefined) {
      const normalizedValue = this.normalizeSlugOrValue(data.value);
      const existing = await this.prisma.attributeOption.findFirst({
        where: {
          categoryAttributeId: attributeId,
          value: normalizedValue,
          id: { not: optionId },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe una opción con el valor "${normalizedValue}" en este atributo`,
        );
      }
      updateData.value = normalizedValue;
    }

    return this.prisma.attributeOption.update({
      where: { id: optionId },
      data: updateData,
    });
  }

  /**
   * Elimina una opción de un atributo (verifica que la opción pertenezca al atributo)
   */
  async deleteAttributeOption(attributeId: number, optionId: number) {
    const option = await this.prisma.attributeOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      throw new NotFoundException('Opción no encontrada');
    }

    if (option.categoryAttributeId !== attributeId) {
      throw new NotFoundException(
        'La opción no pertenece al atributo indicado',
      );
    }

    await this.prisma.attributeOption.delete({
      where: { id: optionId },
    });

    return { deleted: true, id: optionId };
  }

  /**
   * Establece valores de atributos para un producto
   * IMPORTANTE: Para MULTISELECT, permite múltiples valores para el mismo atributo
   */
  async setProductAttributeValues(
    productId: number,
    values: Array<{
      categoryAttributeId: number;
      value: string;
    }>,
  ) {
    // Verificar que el producto existe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          include: {
            attributes: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (!product.category) {
      throw new BadRequestException('El producto no tiene una categoría asignada');
    }

    // Obtener todos los atributos de la categoría del producto
    const categoryAttributes = new Map<number, any>();
    const requiredAttributes = new Set<number>();
    product.category.attributes.forEach((attr) => {
      categoryAttributes.set(attr.id, attr);
      if (attr.isRequired) {
        requiredAttributes.add(attr.id);
      }
    });

    // Validar que todos los atributos requeridos estén presentes
    const providedAttributeIds = new Set(values.map((v) => v.categoryAttributeId));
    const missingRequired = Array.from(requiredAttributes).filter(
      (id) => !providedAttributeIds.has(id),
    );

    if (missingRequired.length > 0) {
      const missingNames = missingRequired
        .map((id) => categoryAttributes.get(id)?.name || `ID ${id}`)
        .join(', ');
      throw new BadRequestException(
        `Faltan atributos requeridos: ${missingNames}`,
      );
    }

    // Validar y procesar cada valor
    const valuesToCreate: Array<{
      productId: number;
      categoryAttributeId: number;
      value: string;
      rawJson: any;
      attributeOptionId: number | null;
    }> = [];

    // Agrupar por categoryAttributeId para manejar MULTISELECT
    const valuesByAttribute = new Map<number, string[]>();
    for (const val of values) {
      if (!valuesByAttribute.has(val.categoryAttributeId)) {
        valuesByAttribute.set(val.categoryAttributeId, []);
      }
      valuesByAttribute.get(val.categoryAttributeId)!.push(val.value);
    }

    // Procesar cada atributo
    for (const [categoryAttributeId, valueList] of valuesByAttribute.entries()) {
      const attribute = categoryAttributes.get(categoryAttributeId);

      if (!attribute) {
        throw new BadRequestException(
          `El atributo con ID ${categoryAttributeId} no pertenece a ninguna categoría del producto`,
        );
      }

      // Validar que SELECT/MULTISELECT tengan opciones
      await this.validateAttributeOptions(categoryAttributeId, attribute.type);

      // Para tipos no-MULTISELECT, solo permitir un valor
      if (attribute.type !== 'MULTISELECT' && valueList.length > 1) {
        throw new BadRequestException(
          `El atributo "${attribute.name}" (tipo ${attribute.type}) solo permite un valor`,
        );
      }

      // Procesar cada valor
      for (const valueStr of valueList) {
        const parsed = await this.parseAndValidateValue(
          categoryAttributeId,
          valueStr,
          attribute.type,
          attribute.minValue,
          attribute.maxValue,
        );

        // Validar coherencia de unit, group y rawJson
        this.validateAttributeCoherence(attribute, parsed.rawJson);

        valuesToCreate.push({
          productId,
          categoryAttributeId,
          value: parsed.value,
          rawJson: parsed.rawJson,
          attributeOptionId: parsed.attributeOptionId,
        });
      }
    }

    // Validar coherencia padre-hijo para atributos con dependsOnAttributeId
    const parentSelectedByAttr = new Map<number, Set<number>>();
    for (const v of valuesToCreate) {
      if (!parentSelectedByAttr.has(v.categoryAttributeId)) {
        parentSelectedByAttr.set(v.categoryAttributeId, new Set());
      }
      if (v.attributeOptionId != null) {
        parentSelectedByAttr.get(v.categoryAttributeId)!.add(v.attributeOptionId);
      }
    }
    for (const attr of categoryAttributes.values()) {
      const dependsOnId = attr.dependsOnAttributeId;
      if (dependsOnId == null) continue;
      const childValues = valuesToCreate.filter(
        (v) => v.categoryAttributeId === attr.id,
      );
      const parentSelected =
        parentSelectedByAttr.get(dependsOnId) ?? new Set<number>();
      for (const cv of childValues) {
        if (cv.attributeOptionId == null) continue;
        const option = await this.prisma.attributeOption.findUnique({
          where: { id: cv.attributeOptionId },
          select: { parentOptionId: true },
        });
        if (!option) continue;
        if (option.parentOptionId == null) {
          throw new BadRequestException({
            message:
              'El valor seleccionado para un atributo dependiente debe ser una opción con parentOptionId que coincida con el atributo padre',
            code: 'ATTRIBUTE_DEPENDENCY_INVALID',
          });
        }
        if (!parentSelected.has(option.parentOptionId)) {
          throw new BadRequestException({
            message:
              'El valor del atributo dependiente no coincide con la opción seleccionada en el atributo padre',
            code: 'ATTRIBUTE_DEPENDENCY_INVALID',
          });
        }
      }
    }

    // Eliminar valores existentes del producto
    await this.prisma.productAttributeValue.deleteMany({
      where: { productId },
    });

    // Crear los nuevos valores
    if (valuesToCreate.length > 0) {
      await this.prisma.productAttributeValue.createMany({
        data: valuesToCreate,
      });
    }

    // Verificar que no haya duplicados para tipos no-MULTISELECT
    const createdValues = await this.prisma.productAttributeValue.findMany({
      where: { productId },
      include: {
        categoryAttribute: true,
      },
    });

    const attributeCounts = new Map<number, number>();
    for (const val of createdValues) {
      const count = attributeCounts.get(val.categoryAttributeId) || 0;
      attributeCounts.set(val.categoryAttributeId, count + 1);

      // Validar unicidad para tipos no-MULTISELECT
      if (
        val.categoryAttribute.type !== 'MULTISELECT' &&
        count > 0
      ) {
        throw new BadRequestException(
          `Se encontraron múltiples valores para el atributo "${val.categoryAttribute.name}" que no es de tipo MULTISELECT`,
        );
      }
    }

    return createdValues;
  }

  /**
   * Reordena los atributos de una categoría según el array recibido.
   * Validaciones: todos los ids existen, pertenecen a la categoría, no hay duplicados,
   * y no se modifican atributos heredados (en el esquema actual no hay herencia de categoría).
   * Actualiza displayOrder en una sola transacción.
   */
  async reorderCategoryAttributes(
    categoryId: number,
    items: Array<{ id: number; displayOrder: number }>,
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const ids = items.map((i) => i.id);

    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException('No se permiten ids duplicados en el reorden');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const attributes = await this.prisma.categoryAttribute.findMany({
      where: { id: { in: ids } },
      select: { id: true, categoryId: true },
    });

    if (attributes.length !== ids.length) {
      const foundIds = new Set(attributes.map((a) => a.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Atributo(s) no encontrado(s): ${missing.join(', ')}`,
      );
    }

    const notInCategory = attributes.filter((a) => a.categoryId !== categoryId);
    if (notInCategory.length > 0) {
      throw new BadRequestException(
        `Algunos atributos no pertenecen a la categoría ${categoryId}: ${notInCategory.map((a) => a.id).join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.categoryAttribute.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );
  }

  /**
   * Obtiene los atributos de una categoría con sus opciones
   * Retorna [] si no hay atributos, pero lanza NotFoundException si la categoría no existe
   */
  async getCategoryAttributes(categoryId: number) {
    // Verificar que la categoría existe
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const attributes = await this.prisma.categoryAttribute.findMany({
      where: { categoryId },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        _count: {
          select: {
            values: true,
          },
        },
      },
      orderBy: [
        { group: 'asc' },
        { displayOrder: 'asc' },
      ],
    });

    return attributes;
  }

  /**
   * Obtiene los valores de atributos de un producto
   */
  async getProductAttributeValues(productId: number) {
    const values = await this.prisma.productAttributeValue.findMany({
      where: { productId },
      include: {
        categoryAttribute: {
          include: {
            options: true,
          },
        },
        attributeOption: true,
      },
    });

    return values;
  }
}

