// src/chat/dto/create-conversation.dto.ts
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateConversationDto {
  @IsInt() @IsPositive()
  otherUserId!: number;

  @IsOptional() @IsInt() @IsPositive()
  storeId?: number;

  @IsOptional() @IsInt() @IsPositive()
  orderId?: number;
}
