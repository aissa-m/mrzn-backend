// src/s3/s3.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  async uploadFile(file: Express.Multer.File, folder = 'products') {
    const sanitizedName = file.originalname.replace(/[^\w.-]/g, '_'); // opcional: limpiar nombre
    const key = `${folder}/${Date.now()}-${randomUUID()}-${sanitizedName}`;
    const bucket = process.env.AWS_S3_BUCKET!;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { url, key }; // 👈 ahora devolvemos ambos
  }
}
