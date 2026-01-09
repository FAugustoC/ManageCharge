import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  const port = configService.get<number>('app.port') || 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  const appName = configService.get<string>('app.name') || 'ManageCharge';
  const nodeEnv = configService.get<string>('app.env') || 'development';

  // Prefijo global
  app.setGlobalPrefix(apiPrefix);

  // Validación global
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

  // CORS
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl') || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Swagger (solo en desarrollo)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${appName} API`)
      .setDescription(
        `API de ${appName} - Sistema de gestión de cobros y clientes.`
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'JWT-auth',
      )
      .addTag('Health', 'Verificación del sistema')
      .addTag('Auth', 'Autenticación y autorización')
      .addTag('Tenants', 'Gestión de empresas/freelancers')
      .addTag('Users', 'Gestión de usuarios')
      .addTag('Clients', 'Gestión de clientes')
      .addTag('Services', 'Gestión de servicios')
      .addTag('Payments', 'Gestión de pagos')
      .addTag('Notifications', 'Sistema de notificaciones')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);

    logger.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  }

  await app.listen(port);

  logger.log(`🚀 ${appName} corriendo en: http://localhost:${port}/${apiPrefix}`);
  logger.log(`🌍 Ambiente: ${nodeEnv}`);
}

bootstrap();