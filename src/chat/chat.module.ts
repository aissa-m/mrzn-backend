// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@Module({
  imports: [PrismaModule, CommonModule, NotificationsModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, WsJwtGuard],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
