import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SellerMode,
  StoreStatus,
  StoreSubscriptionStatus,
} from '@prisma/client';

export interface SellerStoreInfo {
  id: number;
  name: string;
  status: StoreStatus;
  subscriptionStatus: StoreSubscriptionStatus;
}

export interface SellerContext {
  sellerMode: SellerMode;
  store: SellerStoreInfo | null;
  /** Tienda activa con plan: para capa visual/comercial (mostrar como tienda). No bloquea crear productos. */
  canPublishAsStore: boolean;
}

/**
 * Tienda con plan activo: permite mostrar perfil "como tienda".
 * No afecta ownership de productos (siempre del usuario).
 */
export function canStorePublish(
  status: StoreStatus,
  subscriptionStatus: StoreSubscriptionStatus,
): boolean {
  return (
    status === StoreStatus.ACTIVE &&
    subscriptionStatus === StoreSubscriptionStatus.ACTIVE
  );
}

@Injectable()
export class SellerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getSellerContext(userId: number): Promise<SellerContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        sellerMode: true,
        stores: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            status: true,
            subscriptionStatus: true,
          },
        },
      },
    });

    if (!user) {
      return {
        sellerMode: 'PERSONAL',
        store: null,
        canPublishAsStore: false,
      };
    }

    const store = user.stores[0] ?? null;
    const canPublishAsStore =
      store !== null &&
      canStorePublish(store.status, store.subscriptionStatus);

    return {
      sellerMode: user.sellerMode,
      store: store
        ? {
            id: store.id,
            name: store.name,
            status: store.status,
            subscriptionStatus: store.subscriptionStatus,
          }
        : null,
      canPublishAsStore,
    };
  }
}
