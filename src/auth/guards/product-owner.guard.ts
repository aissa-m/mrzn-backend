// src/auth/guards/product-owner.guard.ts
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
export class ProductOwnerGuard implements CanActivate {
  constructor(private readonly ownership: OwnershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtUserPayload; params: Record<string, string> }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Unauthorized');

    if (user.role === 'ADMIN') return true;

    // Acepta /products/:id o /products/:productId
    const { id, productId } = request.params ?? {};
    const raw = id ?? productId;
    const parsed = Number(raw);

    if (!raw || Number.isNaN(parsed)) {
      throw new BadRequestException('Missing or invalid product id parameter');
    }

    const ok = await this.ownership.isProductOwner(user.id, parsed);
    if (!ok)
      throw new ForbiddenException('You are not the owner of this product');

    return true;
  }
}
