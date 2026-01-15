import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy, GoogleStrategy } from './strategies/index.js';
import { JwtAuthGuard } from './guards/index.js';
import { UsersModule } from '../users/index.js';
import { TenantsModule } from '../tenants/index.js';

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

    // Configuración de Passport
    PassportModule.register({
      defaultStrategy: 'jwt', // Estrategia por defecto
    }),

    // Configuración de JWT
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: '15m', // Tiempo por defecto (puede sobreescribirse)
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