import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@aws-sdk/client-s3');
jest.mock('fs');
jest.mock('path');

describe('S3Service', () => {
  let service: S3Service;
  let s3Client: jest.Mocked<S3Client>;

  const mockFile: Express.Multer.File = {
    buffer: Buffer.from('test content'),
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1000,
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  beforeEach(async () => {
    process.env.STORAGE_DRIVER = 'local';
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.AWS_S3_BUCKET = 'test-bucket';

    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service],
    }).compile();

    service = module.get<S3Service>(S3Service);
    s3Client = (S3Client as jest.MockedClass<typeof S3Client>).prototype as any;

    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload file locally when STORAGE_DRIVER is local', async () => {
      const mockJoin = path.join as jest.Mock;
      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockMkdirSync = fs.mkdirSync as jest.Mock;
      const mockWriteFileSync = fs.writeFileSync as jest.Mock;

      mockJoin.mockReturnValue('/uploads/products/test.jpg');
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => {});
      mockWriteFileSync.mockImplementation(() => {});

      const result = await service.uploadFile(mockFile, 'products');

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('key');
    });

    it('should handle file upload with sanitized filename', async () => {
      const mockJoin = path.join as jest.Mock;
      const mockExistsSync = fs.existsSync as jest.Mock;
      const mockMkdirSync = fs.mkdirSync as jest.Mock;
      const mockWriteFileSync = fs.writeFileSync as jest.Mock;

      mockJoin.mockReturnValue('/uploads/products/test_file.jpg');
      mockExistsSync.mockReturnValue(true);

      const fileWithSpecialChars = {
        ...mockFile,
        originalname: 'test file (1).jpg',
      };

      await service.uploadFile(fileWithSpecialChars, 'products');

      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });
});

