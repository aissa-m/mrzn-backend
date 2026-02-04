import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PushTokensService } from './push-tokens.service';
import { PushTokensController } from './push-tokens.controller';
import { ExpoPushService } from './expo-push.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [PushTokensService, ExpoPushService],
  controllers: [PushTokensController],
  exports: [PushTokensService, ExpoPushService],
})
export class PushTokensModule {}
