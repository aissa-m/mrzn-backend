// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  ClassSerializerInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  // Body parser: preserve raw body only for Moosyl webhook (HMAC verification)
  const rawBodyLimit = '1mb';
  app.use(
    express.json({
      limit: rawBodyLimit,
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf: Buffer) => {
        if (req.originalUrl?.includes('/webhooks/moosyl')) {
          req.rawBody = buf;
        }
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: rawBodyLimit }));
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  // Prefijo y versionado
  app.setGlobalPrefix('api');
  app.enableVersioning();

  // Seguridad y rendimiento
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(compression());
  app.use(cookieParser());

  // CORS por entorno
  const isProd = config.get<string>('NODE_ENV') === 'production';
  app.enableCors({
    origin: isProd ? config.get<string>('CORS_ORIGIN')?.split(',') : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-admin-bootstrap-secret',
      'x-webhook-signature',
      'x-webhook-event',
    ],
  });

  // Validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // dto -> tipos nativos
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const formatted = errors.map((e) => ({
          field: e.property,
          constraints: e.constraints,
        }));
        return new BadRequestException({
          message: 'Validación fallida',
          errors: formatted,
        });
      },
    }),
  );

  // Serialización global para @Exclude y grupos
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger solo en dev
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Maurizone API')
      .setDescription('Endpoints de Maurizone')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Apagado elegante
  app.enableShutdownHooks();

  const port = Number(config.get<string>('PORT')) || 3000;
  await app.listen(port, '0.0.0.0');

  const url = await app.getUrl();
  logger.log(`🚀 Servidor corriendo en ${url}`);
  if (!isProd) logger.log(`📘 Swagger disponible en ${url}/api/docs`);
}

void bootstrap();
