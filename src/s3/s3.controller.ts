import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from './s3.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID as uuid } from 'crypto';
import * as mime from 'mime';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload') 
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { productId?: number },
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const bucket = process.env.AWS_S3_BUCKET!;
    const rawExt = (file.mimetype || '').split('/').pop() || 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const key = `tests/${uuid()}.${ext}`;

    await this.s3Service['s3'].send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return { ok: true, url, key, size: file.size };
  }
}
