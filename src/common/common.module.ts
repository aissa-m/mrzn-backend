// src/common/common.module.ts
import { Global, Module } from '@nestjs/common';
import { OwnershipService } from './services/ownership.service';
import { SellerContextService } from './services/seller-context.service';

@Global()
@Module({
  providers: [OwnershipService, SellerContextService],
  exports: [OwnershipService, SellerContextService],
})
export class CommonModule {}
