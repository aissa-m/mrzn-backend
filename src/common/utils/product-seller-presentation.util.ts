import { SellerMode, StoreStatus, StoreSubscriptionStatus } from '@prisma/client';
import { canStorePublish } from '../services/seller-context.service';

export type SellerType = 'STORE' | 'PERSONAL';

/** Fila mínima de Store para resolver presentación (include de Prisma). */
export type ProductLinkedStoreRow = {
  id: number;
  ownerId: number;
  name: string;
  logoUrl: string | null;
  logoImageUrl: string | null;
  status: StoreStatus;
  subscriptionStatus: StoreSubscriptionStatus;
};

/** Fila mínima de User vendedor (include de Prisma). */
export type ProductOwnerUserRow = {
  sellerMode: SellerMode;
  stores: ProductLinkedStoreRow[];
};

/** Logo efectivo para UI: prioriza onboarding (`logoUrl`) y cae a columna legacy (`logoImageUrl`). */
export function storeLogoUrl(s: Pick<ProductLinkedStoreRow, 'logoUrl' | 'logoImageUrl'>) {
  return s.logoUrl ?? s.logoImageUrl ?? null;
}

/**
 * Fuente de verdad combinada:
 * 1) Si el producto tiene `storeId` y la tienda enlazada pertenece al vendedor → STORE (datos persistidos al crear con tienda activa).
 * 2) Si no, pero el usuario está en `sellerMode === STORE` y tiene una tienda publicable → STORE (legacy / productos sin storeId rellenado).
 * 3) En caso contrario → PERSONAL.
 */
export function resolveProductSellerPresentation(
  productUserId: number,
  productStoreId: number | null,
  linkedStore: ProductLinkedStoreRow | null | undefined,
  ownerUser: ProductOwnerUserRow | null | undefined,
): { sellerType: SellerType; store: { id: number; name: string; logoImageUrl: string | null } | null } {
  if (
    productStoreId != null &&
    linkedStore != null &&
    linkedStore.id === productStoreId &&
    linkedStore.ownerId === productUserId
  ) {
    return {
      sellerType: 'STORE',
      store: {
        id: linkedStore.id,
        name: linkedStore.name,
        logoImageUrl: storeLogoUrl(linkedStore),
      },
    };
  }

  if (ownerUser?.sellerMode === SellerMode.STORE) {
    const publishable = ownerUser.stores.find((s) =>
      canStorePublish(s.status, s.subscriptionStatus),
    );
    if (publishable) {
      return {
        sellerType: 'STORE',
        store: {
          id: publishable.id,
          name: publishable.name,
          logoImageUrl: storeLogoUrl(publishable),
        },
      };
    }
  }

  return { sellerType: 'PERSONAL', store: null };
}

export const productSellerPrismaSelect = {
  store: {
    select: {
      id: true,
      ownerId: true,
      name: true,
      logoUrl: true,
      logoImageUrl: true,
      status: true,
      subscriptionStatus: true,
    },
  },
  user: {
    select: {
      id: true,
      sellerMode: true,
      stores: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          ownerId: true,
          name: true,
          logoUrl: true,
          logoImageUrl: true,
          status: true,
          subscriptionStatus: true,
        },
      },
    },
  },
} as const;
