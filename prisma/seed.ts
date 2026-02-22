import { PrismaClient, AttributeType, Role, StoreStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SEED_DEMO = process.env.SEED_DEMO === 'true';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

interface CategorySeed {
  name: string;
  slug: string;
  attributes: Array<{
    name: string;
    slug: string;
    type: AttributeType;
    unit?: string;
    minValue?: number;
    maxValue?: number;
    options?: Array<{ label: string; value: string }>;
  }>;
}

const CATEGORIES: CategorySeed[] = [
  {
    name: 'Electronics',
    slug: 'electronics',
    attributes: [
      { name: 'brand', slug: 'brand', type: 'TEXT' },
      {
        name: 'condition',
        slug: 'condition',
        type: 'SELECT',
        options: [
          { label: 'New', value: 'new' },
          { label: 'Used', value: 'used' },
        ],
      },
      {
        name: 'storage',
        slug: 'storage',
        type: 'SELECT',
        options: [
          { label: '64GB', value: '64gb' },
          { label: '128GB', value: '128gb' },
          { label: '256GB', value: '256gb' },
        ],
      },
      {
        name: 'color',
        slug: 'color',
        type: 'SELECT',
        options: [
          { label: 'Black', value: 'black' },
          { label: 'White', value: 'white' },
          { label: 'Blue', value: 'blue' },
        ],
      },
    ],
  },
  {
    name: 'Vehicles',
    slug: 'vehicles',
    attributes: [
      { name: 'brand', slug: 'brand', type: 'TEXT' },
      {
        name: 'mileage',
        slug: 'mileage',
        type: 'NUMBER',
        unit: 'km',
        minValue: 0,
      },
      {
        name: 'fuelType',
        slug: 'fuel-type',
        type: 'SELECT',
        options: [
          { label: 'Petrol', value: 'petrol' },
          { label: 'Diesel', value: 'diesel' },
          { label: 'Electric', value: 'electric' },
        ],
      },
    ],
  },
  {
    name: 'Home',
    slug: 'home',
    attributes: [
      { name: 'material', slug: 'material', type: 'TEXT' },
      {
        name: 'condition',
        slug: 'condition',
        type: 'SELECT',
        options: [
          { label: 'New', value: 'new' },
          { label: 'Used', value: 'used' },
        ],
      },
    ],
  },
  {
    name: 'Fashion',
    slug: 'fashion',
    attributes: [
      {
        name: 'size',
        slug: 'size',
        type: 'SELECT',
        options: [
          { label: 'S', value: 's' },
          { label: 'M', value: 'm' },
          { label: 'L', value: 'l' },
          { label: 'XL', value: 'xl' },
        ],
      },
      { name: 'color', slug: 'color', type: 'TEXT' },
    ],
  },
];

async function seedCategories(): Promise<Map<string, { id: number; name: string }>> {
  const created: string[] = [];
  const categoryIds = new Map<string, { id: number; name: string }>();

  for (const cat of CATEGORIES) {
    const slug = slugify(cat.slug) || cat.slug;
    const category = await prisma.category.upsert({
      where: { slug },
      create: {
        name: cat.name,
        slug,
        description: null,
      },
      update: {},
    });
    categoryIds.set(slug, { id: category.id, name: category.name });
    created.push(category.name);
  }

  if (created.length > 0) {
    console.log('[seed] Categories created/updated:', created.join(', '));
  }
  return categoryIds;
}

async function seedCategoryAttributes(
  categoryIds: Map<string, { id: number; name: string }>
): Promise<void> {
  let attributeCount = 0;

  for (const cat of CATEGORIES) {
    const slug = slugify(cat.slug) || cat.slug;
    const meta = categoryIds.get(slug);
    if (!meta) continue;

    const categoryId = meta.id;

    for (let i = 0; i < cat.attributes.length; i++) {
      const attr = cat.attributes[i];
      const attrSlug = slugify(attr.slug) || attr.slug;
      const attribute = await prisma.categoryAttribute.upsert({
        where: {
          categoryId_slug: { categoryId, slug: attrSlug },
        },
        create: {
          categoryId,
          name: attr.name,
          slug: attrSlug,
          type: attr.type,
          displayOrder: i,
          unit: attr.unit ?? null,
          minValue: attr.minValue ?? null,
          maxValue: attr.maxValue ?? null,
        },
        update: {},
      });

      if (attr.options && attr.options.length > 0) {
        const optionsData = attr.options.map((opt, order) => ({
          categoryAttributeId: attribute.id,
          label: opt.label,
          value: opt.value.toLowerCase().trim(),
          displayOrder: order,
        }));
        await prisma.attributeOption.createMany({
          data: optionsData,
          skipDuplicates: true,
        });
      }
      attributeCount++;
    }
  }

  if (attributeCount > 0) {
    console.log('[seed] Category attributes/options created/updated:', attributeCount, 'attributes');
  }
}

async function seedDemoUsers(): Promise<Map<string, number>> {
  const userIds = new Map<string, number>();
  const demoUsers = [
    {
      email: 'admin@maurizone.com',
      password: 'Admin123!',
      role: 'ADMIN' as Role,
      name: 'Admin',
      key: 'ADMIN',
    },
    {
      email: 'owner@maurizone.com',
      password: 'Owner123!',
      role: 'STORE_OWNER' as Role,
      name: 'Store Owner',
      key: 'STORE_OWNER',
    },
    {
      email: 'user@maurizone.com',
      password: 'User123!',
      role: 'USER' as Role,
      name: 'Demo User',
      key: 'USER',
    },
  ];

  for (const u of demoUsers) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: hashedPassword,
        role: u.role,
        name: u.name,
      },
    });
    userIds.set(u.key, user.id);
  }

  console.log('[seed] Demo users created/updated: admin, owner, user');
  return userIds;
}

async function seedDemoStore(ownerId: number): Promise<number> {
  const store = await prisma.store.upsert({
    where: {
      ownerId_name: { ownerId, name: 'Demo Store' },
    },
    create: {
      ownerId,
      name: 'Demo Store',
      status: StoreStatus.ACTIVE,
      city: 'Nouakchott',
      description: 'Demo store for testing',
    },
    update: {},
  });
  console.log('[seed] Demo store created/updated: Demo Store');
  return store.id;
}

async function seedDemoProduct(
  storeId: number,
  categoryId: number,
  electronicsAttributeIds: Map<string, number>,
  electronicsOptionIds: Map<string, number>
): Promise<void> {
  const product = await prisma.product.upsert({
    where: {
      storeId_name: { storeId, name: 'iPhone Demo' },
    },
    create: {
      storeId,
      categoryId,
      name: 'iPhone Demo',
      description: 'Demo product for testing',
      price: 1000,
    },
    update: {},
  });

  const brandAttrId = electronicsAttributeIds.get('brand');
  const conditionAttrId = electronicsAttributeIds.get('condition');
  const storageAttrId = electronicsAttributeIds.get('storage');
  const colorAttrId = electronicsAttributeIds.get('color');

  const valuesToCreate: Array<{
    productId: number;
    categoryAttributeId: number;
    value: string;
    attributeOptionId?: number;
  }> = [];

  if (brandAttrId) {
    valuesToCreate.push({
      productId: product.id,
      categoryAttributeId: brandAttrId,
      value: 'Apple',
    });
  }
  if (conditionAttrId) {
    const optId = electronicsOptionIds.get('new');
    if (optId) {
      valuesToCreate.push({
        productId: product.id,
        categoryAttributeId: conditionAttrId,
        value: 'new',
        attributeOptionId: optId,
      });
    }
  }
  if (storageAttrId) {
    const optId = electronicsOptionIds.get('128gb');
    if (optId) {
      valuesToCreate.push({
        productId: product.id,
        categoryAttributeId: storageAttrId,
        value: '128gb',
        attributeOptionId: optId,
      });
    }
  }
  if (colorAttrId) {
    const optId = electronicsOptionIds.get('black');
    if (optId) {
      valuesToCreate.push({
        productId: product.id,
        categoryAttributeId: colorAttrId,
        value: 'black',
        attributeOptionId: optId,
      });
    }
  }

  if (valuesToCreate.length > 0) {
    const existing = await prisma.productAttributeValue.findMany({
      where: { productId: product.id },
      select: { categoryAttributeId: true },
    });
    const existingAttrIds = new Set(existing.map((e) => e.categoryAttributeId));
    const toInsert = valuesToCreate.filter(
      (v) => !existingAttrIds.has(v.categoryAttributeId)
    );
    if (toInsert.length > 0) {
      await prisma.productAttributeValue.createMany({
        data: toInsert,
      });
    }
  }

  console.log('[seed] Demo product created/updated: iPhone Demo with attribute values');
}

async function getElectronicsAttributeAndOptionIds(): Promise<{
  attributeIds: Map<string, number>;
  optionIds: Map<string, number>;
}> {
  const category = await prisma.category.findUnique({
    where: { slug: 'electronics' },
    include: {
      attributes: {
        include: { options: true },
      },
    },
  });

  const attributeIds = new Map<string, number>();
  const optionIds = new Map<string, number>();

  if (!category) return { attributeIds, optionIds };

  for (const attr of category.attributes) {
    attributeIds.set(attr.slug, attr.id);
    for (const opt of attr.options) {
      optionIds.set(opt.value, opt.id);
    }
  }
  return { attributeIds, optionIds };
}

async function main(): Promise<void> {
  console.log('[seed] Starting seed. SEED_DEMO =', SEED_DEMO);

  try {
    const categoryIds = await seedCategories();
    await seedCategoryAttributes(categoryIds);

    if (SEED_DEMO) {
      const userIds = await seedDemoUsers();
      const ownerId = userIds.get('STORE_OWNER');
      if (ownerId == null) {
        console.warn('[seed] STORE_OWNER user not found; skipping demo store and product.');
      } else {
        const storeId = await seedDemoStore(ownerId);
        const electronicsMeta = categoryIds.get('electronics');
        if (electronicsMeta && storeId) {
          const { attributeIds, optionIds } = await getElectronicsAttributeAndOptionIds();
          await seedDemoProduct(
            storeId,
            electronicsMeta.id,
            attributeIds,
            optionIds
          );
        }
      }
    } else {
      console.log('[seed] Demo users, store and products skipped (SEED_DEMO is not "true").');
    }

    console.log('[seed] Seeding completed successfully.');
  } catch (err) {
    console.error('[seed] Error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main();
