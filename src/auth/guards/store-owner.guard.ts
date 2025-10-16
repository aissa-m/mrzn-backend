// src/auth/guards/store-owner.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OwnershipService } from '../../common/services/ownership.service';
import { JwtUserPayload } from '../types';

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  constructor(private readonly ownership: OwnershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload; params: Record<string, string> }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Unauthorized');

    // Los admins pasan siempre
    if (user.role === 'ADMIN') return true;

    // Intentamos leer el id de tienda desde params: /stores/:id o /stores/:storeId
    const { id, storeId } = request.params ?? {};
    const raw = id ?? storeId;
    const parsed = Number(raw);

    if (!raw || Number.isNaN(parsed)) {
      throw new BadRequestException('Missing or invalid store id parameter');
    }

    const ok = await this.ownership.isStoreOwner(user.id, parsed);
    if (!ok)
      throw new ForbiddenException('You are not the owner of this store');

    return true;
  }
}
