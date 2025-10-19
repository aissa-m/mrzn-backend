// src/common/services/ownership.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    const count = await this.prisma.store.count({
      where: { id: storeId, ownerId: userId },
    });
    return count > 0;
  }
  async isStoreOwnerOrAdmin(
    user: { id: number; role: 'USER' | 'STORE_OWNER' | 'ADMIN' },
    storeId: number,
  ) {
    if (user.role === 'ADMIN') return true;
    return this.isStoreOwner(user.id, storeId);
  }
  async isProductOwner(userId: number, productId: number): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: { id: productId, store: { ownerId: userId } },
    });
    return count > 0;
  }
}
