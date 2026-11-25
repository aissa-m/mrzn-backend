// src/common/services/ownership.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    const ownerId = Math.trunc(Number(userId));
    const sid = Math.trunc(Number(storeId));
    if (!Number.isFinite(ownerId) || !Number.isFinite(sid) || ownerId < 1 || sid < 1) {
      console.log('[OwnershipService.isStoreOwner] ids inválidos → false', {
        userIdRaw: userId,
        storeIdRaw: storeId,
        ownerId,
        sid,
      });
      return false;
    }
    const count = await this.prisma.store.count({
      where: { id: sid, ownerId },
    });
    console.log('[OwnershipService.isStoreOwner] prisma.store.count', {
      where: { id: sid, ownerId },
      count,
      allowed: count > 0,
    });
    return count > 0;
  }
  async isStoreOwnerOrAdmin(
    user: { id: number; role: 'USER' | 'STORE_OWNER' | 'ADMIN' },
    storeId: number,
  ) {
    const coercedUserId = Math.trunc(Number(user.id));
    const coercedStoreId = Math.trunc(Number(storeId));
    const isAdmin = user.role === 'ADMIN';

    console.log('\n========== [OwnershipService.isStoreOwnerOrAdmin] ==========');
    console.log('request.user.id (valor crudo):', user.id, '| typeof:', typeof user.id);
    console.log('request.user.id (coerción Math.trunc Number):', coercedUserId);
    console.log('request.user.role:', user.role);
    console.log('isAdmin:', isAdmin);
    console.log('storeId (crudo):', storeId, '| typeof:', typeof storeId);
    console.log('storeId (coerción):', coercedStoreId);

    if (isAdmin) {
      console.log('resultado comprobación propiedad: true (admin)');
      console.log('============================================================\n');
      return true;
    }

    const allowed = await this.isStoreOwner(coercedUserId, coercedStoreId);
    console.log('resultado final isStoreOwnerOrAdmin:', allowed);
    console.log('============================================================\n');
    return allowed;
  }
  /** Ownership real por Product.userId (marketplace unificado). */
  async isProductOwner(userId: number, productId: number): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: { id: productId, userId },
    });
    return count > 0;
  }
}
