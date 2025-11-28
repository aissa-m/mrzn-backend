// src/s3/s3.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class S3Service {
  private storageType = process.env.STORAGE_DRIVER || 's3'; // 's3' | 'local'

  private s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  /**
   * Upload file to S3 or Local depending on STORAGE_DRIVER
   */
  async uploadFile(file: Express.Multer.File, folder = 'products') {
    if (this.storageType === 'local') {
      return this.uploadLocal(file, folder);
    } else {
      return this.uploadS3(file, folder);
    }
  }

  /**
   * Upload to S3
   */
  private async uploadS3(file: Express.Multer.File, folder: string) {
    const sanitizedName = file.originalname.replace(/[^\w.-]/g, '_');
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
    return { url, key };
  }

  /**
   * Upload to local storage (e.g., /uploads/products)
   */
  private async uploadLocal(file: Express.Multer.File, folder: string) {
    const sanitizedName = file.originalname.replace(/[^\w.-]/g, '_');
    const fileName = `${Date.now()}-${randomUUID()}-${sanitizedName}`;

    const uploadFolder = path.join(process.cwd(), 'uploads', folder);

    // Create folder if it does not exist
    if (!fs.existsSync(uploadFolder)) {
      fs.mkdirSync(uploadFolder, { recursive: true });
    }

    const filePath = path.join(uploadFolder, fileName);

    // Write file buffer to disk
    fs.writeFileSync(filePath, file.buffer);

    const url = `${process.env.APP_URL}/uploads/${folder}/${fileName}`;

    return {
      url,
      key: `uploads/${folder}/${fileName}`,
    };
  }
}
