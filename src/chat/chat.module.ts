// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway'; // ✨ NUEVO
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtModule } from '@nestjs/jwt'; // ✨ Para WsJwtGuard

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    NotificationsModule,
    JwtModule.register({}),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway], 
})
export class ChatModule {}