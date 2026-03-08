// src/chat/dto/create-conversation.dto.ts
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateConversationDto {
  /** Requerido si no se envía productId. Si se envía productId, debe coincidir con Product.userId (vendedor). */
  @IsOptional()
  @IsInt()
  @IsPositive()
  otherUserId?: number;

  /** Opcional. En flujo por productId se toma de Product.storeId. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  storeId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @IsOptional()
  @IsInt()
  productId?: number; // 👈 nuevo
}
