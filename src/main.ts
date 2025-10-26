// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🧹 Validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // 📘 Configurar Swagger dentro de bootstrap
  const config = new DocumentBuilder()
    .setTitle('Maurizone API')
    .setDescription('Endpoints de Maurizone')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer', // 👈 nombre del esquema
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);


  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  // 🚀 Iniciar servidor
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Servidor corriendo en http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📘 Swagger disponible en http://localhost:${process.env.PORT ?? 3000}/docs`);
}

void bootstrap();
