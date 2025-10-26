// src/chat/dto/send-message.dto.ts
import { IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsInt() @IsPositive()
  conversationId!: number;

  @IsString() @MinLength(1) @MaxLength(4_000)
  content!: string; // texto
}
