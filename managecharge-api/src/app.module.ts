import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { configuration } from './config/index.js';
import { DatabaseModule } from './database/index.js';
import { HttpExceptionFilter } from './common/index.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

/**
 * AppModule - Módulo Principal
 */
@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // Conexión a MongoDB
    DatabaseModule,

    // Módulos de negocio (se agregarán en próximas semanas)
    // AuthModule,
    // TenantsModule,
    // UsersModule,
    // ClientsModule,
    // ServicesModule,
    // PaymentsModule,
    // NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}