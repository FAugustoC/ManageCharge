import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy, GoogleStrategy } from './strategies/index.js';
import { JwtAuthGuard } from './guards/index.js';
import { UsersModule } from '../users/index.js';
import { TenantsModule, Tenant, TenantSchema } from '../tenants/index.js';

// Importar modelo Tenant para JwtStrategy

/**
 * AuthModule
 *
 * @description Módulo que encapsula toda la funcionalidad de autenticación:
 * - Registro y login con email/password
 * - Login con Google OAuth
 * - Generación y validación de tokens JWT
 * - Guards para proteger rutas
 *
 * Dependencias:
 * - UsersModule: Para crear y buscar usuarios
 * - TenantsModule: Para validar tenants en el registro
 * - PassportModule: Framework de autenticación
 * - JwtModule: Manejo de tokens JWT
 */
@Module({
  imports: [
    // Módulos de negocio necesarios
    UsersModule,
    TenantsModule,

    // Registrar modelo Tenant para que JwtStrategy
    // pueda cargar la suscripción en cada request autenticada
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
    ]),

    // Configuración de Passport
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    // Configuración de JWT
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
  ],
  providers: [
    // Servicio principal
    AuthService,

    // Estrategias de Passport
    JwtStrategy,
    GoogleStrategy,

    // Guard de JWT (disponible para inyección)
    JwtAuthGuard,
  ],
  exports: [
    // Exportamos para usar en otros módulos
    AuthService,
    JwtAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}