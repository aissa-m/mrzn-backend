import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { MoosylApiService } from './moosyl-api.service';
import { MoosylService } from './moosyl.service';
import { WalletController } from './moosyl.controller';
import { MoosylWebhookController } from './moosyl-webhook.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [WalletController, MoosylWebhookController],
  providers: [MoosylApiService, MoosylService],
})
export class MoosylModule {}
