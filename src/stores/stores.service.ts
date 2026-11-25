import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { OwnershipService } from '../common/services/ownership.service';
import { SellerContextService } from '../common/services/seller-context.service';
import { S3Service } from '../s3/s3.service';
import type { StoreBrandUploadFiles } from './types/store-upload-files.type';
import { StoreStatus, StoreSubscriptionStatus, StoreBusinessType } from '@prisma/client';

/** Prefijo fijo de Mauritania para teléfono de tienda. El frontend solo envía la parte local. */
const MAURITANIA_PHONE_PREFIX = '+222';

/** Normaliza parte local a número completo +222XXXXXXXX (solo dígitos). */
function normalizeStorePhone(localPart: string | undefined): string | undefined {
  if (!localPart) return undefined;
  const digits = localPart.replace(/\D/g, '');
  return digits.length >= 8 ? `${MAURITANIA_PHONE_PREFIX}${digits}` : undefined;
}

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly sellerContext: SellerContextService,
    private readonly s3Service: S3Service,
  ) {}

  private readonly logger = new Logger(StoresService.name);

  /** Sube logo/banner a la misma ruta que productos (S3 o local según STORAGE_DRIVER). Prioridad en cliente: archivo > URL en body. */
  private async uploadBrandFilesToPatch(
    storeId: number,
    files: StoreBrandUploadFiles | undefined,
  ): Promise<{ logoUrl?: string; bannerUrl?: string }> {
    const patch: { logoUrl?: string; bannerUrl?: string } = {};
    if (!files) return patch;
    const prefix = `stores/${storeId}`;
    const logo = files.logo?.[0];
    const banner = files.banner?.[0];
    if (logo) {
      try {
        patch.logoUrl = (await this.s3Service.uploadFile(logo, prefix)).url;
      } catch (err) {
        this.logger.error({ err, storeId, field: 'logo' }, 'Store logo upload failed');
        throw new BadRequestException('No se pudo subir el logo de la tienda');
      }
    }
    if (banner) {
      try {
        patch.bannerUrl = (await this.s3Service.uploadFile(banner, prefix)).url;
      } catch (err) {
        this.logger.error({ err, storeId, field: 'banner' }, 'Store banner upload failed');
        throw new BadRequestException('No se pudo subir el banner de la tienda');
      }
    }
    return patch;
  }

  /** Máximo una tienda por cuenta. Al crear se activa subscriptionStatus ACTIVE y user.sellerMode STORE. */
  async create(
    ownerId: number,
    dto: CreateStoreDto,
    files?: StoreBrandUploadFiles,
  ) {
    const existingCount = await this.prisma.store.count({
      where: { ownerId },
    });
    if (existingCount >= 1) {
      throw new BadRequestException(
        'Solo puede tener una tienda por cuenta. Ya tiene una tienda asociada.',
      );
    }

    const phone = normalizeStorePhone(dto.phoneLocalPart);
    if (phone) {
      const existing = await this.prisma.store.findUnique({
        where: { phone },
      });
      if (existing) {
        throw new BadRequestException(
          'Ya existe una tienda con ese número de teléfono. El teléfono de tienda debe ser único.',
        );
      }
    }

    this.logger.log(
      {
        message: 'Creating store',
        ownerId,
        payload: {
          logoUrl: dto.logoUrl,
          bannerUrl: dto.bannerUrl,
          logoImageUrl: dto.logoImageUrl,
          coverImageUrl: dto.coverImageUrl,
        },
      },
      'StoresService.create',
    );

    let store = await this.prisma.store.create({
      data: {
        ownerId,
        name: dto.name,
        description: dto.description,
        businessType: dto.businessType as StoreBusinessType | undefined,
        logoUrl: dto.logoUrl,
        bannerUrl: dto.bannerUrl,
        phone,
        regionCode: dto.regionCode,
        regionName: dto.regionName,
        departmentCode: dto.departmentCode,
        departmentName: dto.departmentName,
        address: dto.address,
        city: dto.city,
        region: dto.region,
        contactEmail: dto.contactEmail,
        logoImageUrl: dto.logoImageUrl,
        coverImageUrl: dto.coverImageUrl,
        contactPhone: dto.contactPhone,
        whatsappNumber: dto.whatsappNumber,
        facebookUrl: dto.facebookUrl,
        instagramUrl: dto.instagramUrl,
        twitterUrl: dto.twitterUrl,
        tiktokUrl: dto.tiktokUrl,
        websiteUrl: dto.websiteUrl,
        status: (dto.status as StoreStatus) ?? StoreStatus.ACTIVE,
        subscriptionStatus: StoreSubscriptionStatus.ACTIVE,
      },
    });

    const uploadPatch = await this.uploadBrandFilesToPatch(store.id, files);
    if (Object.keys(uploadPatch).length > 0) {
      store = await this.prisma.store.update({
        where: { id: store.id },
        data: uploadPatch,
      });
    }

    this.logger.log(
      {
        message: 'Store created',
        storeId: store.id,
        images: {
          logoUrl: store.logoUrl,
          bannerUrl: store.bannerUrl,
          logoImageUrl: store.logoImageUrl,
          coverImageUrl: store.coverImageUrl,
        },
      },
      'StoresService.create',
    );

    const ownerBefore = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { role: true },
    });
    await this.prisma.user.update({
      where: { id: ownerId },
      data: {
        sellerMode: 'STORE',
        ...(ownerBefore?.role === 'USER' ? { role: 'STORE_OWNER' } : {}),
      },
    });

    return store;
  }

  async findAll() {
    const stores = await this.prisma.store.findMany({
      where: { status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return stores.map((store) => ({
      ...store,
      productsCount: store._count.products,
    }));
  }

  async findAllByOwner(ownerId: number) {
    const stores = await this.prisma.store.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return stores.map((store) => ({
      ...store,
      productsCount: store._count.products,
    }));
  }

  /** Contexto de vendedor para el usuario (sellerMode, store, canPublishAsStore). */
  async getMySellerContext(ownerId: number) {
    return this.sellerContext.getSellerContext(ownerId);
  }

  async findOne(id: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return {
      ...store,
      productsCount: store._count.products,
    };
  }

  async update(
    user: { id: number; role: 'USER' | 'STORE_OWNER' | 'ADMIN' },
    id: number,
    dto: UpdateStoreDto,
    files?: StoreBrandUploadFiles,
  ) {
    const storeId = Math.trunc(Number(id));
    const actorId = Math.trunc(Number(user.id));

    console.log('\n========== [StoresService.update] AUTORIZACIÓN PATCH /stores/:id ==========');
    console.log('(1) id ruta (número recibido por servicio):', id, '| typeof:', typeof id);
    console.log('(2) storeId coerción Math.trunc(Number):', storeId);
    console.log('(3) JWT user.id (crudo):', user.id, '| typeof:', typeof user.id);
    console.log('(4) actorId coerción Math.trunc(Number):', actorId);
    console.log('(5) JWT user.role:', user.role);

    if (!Number.isFinite(storeId) || storeId < 1 || !Number.isFinite(actorId) || actorId < 1) {
      console.log('(6) RESULTADO: 400 — storeId o actorId inválido');
      console.log('==========================================================================\n');
      throw new BadRequestException('Identificador de tienda o usuario inválido');
    }

    const actor = { id: actorId, role: user.role };

    const storeRow = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, ownerId: true, name: true },
    });

    console.log('(6) Fila tienda cargada (storeRow):', storeRow);

    if (!storeRow) {
      console.log('(7) RESULTADO: 404 — tienda no existe');
      console.log('==========================================================================\n');
      throw new NotFoundException('Store not found');
    }

    const ownerMatchesStrict = storeRow.ownerId === actorId;
    const ownerMatchesLoose = storeRow.ownerId == (user.id as unknown);
    const isAdmin = user.role === 'ADMIN';

    console.log('(7) storeRow.id:', storeRow.id, '| storeRow.ownerId:', storeRow.ownerId);
    console.log('(8) ownerId === actorId (estricto):', ownerMatchesStrict);
    console.log(
      '(9) ownerId == user.id (flexible; típico mismatch: number vs string desde JWT):',
      ownerMatchesLoose,
    );
    console.log('(10) isAdmin:', isAdmin);

    const allowed = await this.ownership.isStoreOwnerOrAdmin(actor, storeId);
    console.log('(11) isStoreOwnerOrAdmin (resultado final antes de 403):', allowed);

    if (!allowed) {
      console.log('(12) RESULTADO: 403 Forbidden — no propietario ni admin');
      console.log('==========================================================================\n');
      throw new ForbiddenException('Not allowed to update this store');
    }

    console.log('(12) RESULTADO: permitido — se continúa el update');
    console.log('==========================================================================\n');

    let phoneValue: string | null | undefined;
    if (dto.phoneLocalPart !== undefined) {
      phoneValue = dto.phoneLocalPart === '' ? null : normalizeStorePhone(dto.phoneLocalPart);
    }
    if (phoneValue) {
      const existing = await this.prisma.store.findFirst({
        where: { phone: phoneValue, id: { not: storeId } },
      });
      if (existing) {
        throw new BadRequestException(
          'Ya existe otra tienda con ese número de teléfono. El teléfono de tienda debe ser único.',
        );
      }
    }

    const updateData: Parameters<PrismaService['store']['update']>[0]['data'] = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.businessType !== undefined && { businessType: dto.businessType as StoreBusinessType }),
      ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
      ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
      ...(dto.phoneLocalPart !== undefined && { phone: phoneValue === null ? null : phoneValue ?? undefined }),
      ...(dto.regionCode !== undefined && { regionCode: dto.regionCode }),
      ...(dto.regionName !== undefined && { regionName: dto.regionName }),
      ...(dto.departmentCode !== undefined && { departmentCode: dto.departmentCode }),
      ...(dto.departmentName !== undefined && { departmentName: dto.departmentName }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.region !== undefined && { region: dto.region }),
      ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
      ...(dto.logoImageUrl !== undefined && { logoImageUrl: dto.logoImageUrl }),
      ...(dto.coverImageUrl !== undefined && { coverImageUrl: dto.coverImageUrl }),
      ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone }),
      ...(dto.whatsappNumber !== undefined && { whatsappNumber: dto.whatsappNumber }),
      ...(dto.facebookUrl !== undefined && { facebookUrl: dto.facebookUrl }),
      ...(dto.instagramUrl !== undefined && { instagramUrl: dto.instagramUrl }),
      ...(dto.twitterUrl !== undefined && { twitterUrl: dto.twitterUrl }),
      ...(dto.tiktokUrl !== undefined && { tiktokUrl: dto.tiktokUrl }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl }),
      ...(dto.status !== undefined && { status: dto.status as StoreStatus }),
      ...(dto.subscriptionStatus !== undefined && {
        subscriptionStatus: dto.subscriptionStatus as StoreSubscriptionStatus,
      }),
    };

    const uploadPatch = await this.uploadBrandFilesToPatch(storeId, files);
    Object.assign(updateData, uploadPatch);

    return this.prisma.store.update({ where: { id: storeId }, data: updateData });
  }

  async remove(
    user: { id: number; role: 'USER' | 'STORE_OWNER' | 'ADMIN' },
    id: number,
  ) {
    const allowed = await this.ownership.isStoreOwnerOrAdmin(user, id);
    if (!allowed)
      throw new ForbiddenException('Not allowed to delete this store');

    await this.findOne(id);

    const productsCount = await this.prisma.product.count({
      where: { storeId: id },
    });

    if (productsCount > 0) {
      throw new ForbiddenException(
        'Cannot delete a store that has associated products',
      );
    }

    await this.prisma.store.delete({ where: { id } });

    const actor = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    // Máximo una tienda por cuenta: al eliminar, modo PERSONAL; bajar rol si solo era STORE_OWNER por la tienda
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        sellerMode: 'PERSONAL',
        ...(actor?.role === 'STORE_OWNER' ? { role: 'USER' } : {}),
      },
    });

    return { ok: true };
  }
}
