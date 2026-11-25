import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';
import { S3Service } from '../s3/s3.service';
import { NormalizeStoreMultipartBodyInterceptor } from './interceptors/normalize-store-multipart-body.interceptor';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [StoresController],
  providers: [
    StoresService,
    S3Service,
    NormalizeStoreMultipartBodyInterceptor,
  ],
  exports: [StoresService],
})
export class StoresModule {}
