// src/attributes/attributes.module.ts
import { Module } from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}

