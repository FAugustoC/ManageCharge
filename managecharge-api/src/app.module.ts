import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { configuration } from './config/index.js';
import { DatabaseModule } from './database/index.js';
import { HttpExceptionFilter } from './common/index.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

// Módulos de negocio
import { TenantsModule } from './modules/tenants/index.js';
import { UsersModule } from './modules/users/index.js';
import { AuthModule } from './modules/auth/index.js';
import { ClientsModule} from './modules/clients/index.js';
import { ServicesModule } from './modules/services/index.js';

// Guards
import { JwtAuthGuard } from './modules/auth/guards/index.js';

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

    // Módulos de negocio
    TenantsModule,
    UsersModule,
    AuthModule,
    ClientsModule,
    ServicesModule,
    // PaymentsModule,
    // NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    
    // Filtro global de excepciones
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    
    // Guard global de autenticación JWT
    // Todas las rutas requieren autenticación excepto las marcadas con @Public()
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}