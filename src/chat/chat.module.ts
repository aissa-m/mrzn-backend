// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module'; 
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, CommonModule, NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
