import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';
import { S3Service } from '../s3/s3.service';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService, S3Service],
})
export class ProductsModule {}
