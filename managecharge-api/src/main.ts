import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Obtener configuración
  const port = configService.get<number>('app.port') || 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const appName = configService.get<string>('app.name') || 'ManageCharge';
  const environment = configService.get<string>('app.env') || 'development';

  // Configurar prefijo global
  app.setGlobalPrefix(apiPrefix);

  // Configurar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configurar CORS
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl') || 'http://localhost:3001',
    credentials: true,
  });

  // Configurar Swagger (solo en desarrollo)
  if (environment === 'development') {
    const config = new DocumentBuilder()
      .setTitle(appName)
      .setDescription('API de gestión de cobros y clientes')
      .setVersion('1.0')
      // Agregar configuración de autenticación Bearer
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Ingresa tu token JWT',
          in: 'header',
        },
        'JWT-auth', // Este nombre se usa como referencia
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    console.log(`[Bootstrap] 📚 Swagger docs: http://localhost:${port}/docs`);
  }

  await app.listen(port);
  console.log(`[Bootstrap] 🚀 ${appName} corriendo en: http://localhost:${port}/${apiPrefix}`);
  console.log(`[Bootstrap] 🌍 Ambiente: ${environment}`);
}

bootstrap();