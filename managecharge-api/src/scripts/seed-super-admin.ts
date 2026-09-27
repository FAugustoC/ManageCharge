/**
 * Script de seed: crear el primer SUPER_ADMIN
 *
 * @description Resuelve el problema del "huevo o la gallina": el endpoint
 * POST /super-admin/users solo lo puede usar un super admin, así que el
 * primero tiene que crearse desde fuera del API.
 *
 * Uso:
 *   1. Define en tu .env las variables SUPER_ADMIN_* (ver .env.example)
 *   2. Ejecuta: npm run seed:super-admin
 *   3. Borra SUPER_ADMIN_PASSWORD del .env una vez creado el usuario
 *
 * Es IDEMPOTENTE: se puede ejecutar varias veces sin duplicar nada.
 * Si el super admin ya existe, simplemente lo informa y termina.
 *
 * No arranca el servidor HTTP ni los cron jobs: solo carga lo mínimo
 * necesario (configuración, base de datos y UsersModule).
 */
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { configuration } from '../config/index.js';
import { DatabaseModule } from '../database/index.js';
import { UsersModule } from '../modules/users/users.module.js';
import { UsersService } from '../modules/users/users.service.js';
import { UserRole, AuthProvider } from '../common/enums/index.js';
import { PASSWORD_CONFIG } from '../common/constants/app.constants.js';

/**
 * Módulo mínimo para el seed
 *
 * @description Usamos un módulo propio en lugar de AppModule para no
 * levantar el ScheduleModule (cron de cobros), Stripe ni los controladores.
 * Un script de mantenimiento nunca debería poder disparar un cobro.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    DatabaseModule,
    UsersModule,
  ],
})
class SeedModule { }

const logger = new Logger('SeedSuperAdmin');

async function bootstrap(): Promise<void> {
  // createApplicationContext crea el contenedor de dependencias de Nest
  // (para poder usar UsersService) pero SIN servidor HTTP.
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const config = app.get(ConfigService);
    const usersService = app.get(UsersService);

    const email = config.get<string>('SUPER_ADMIN_EMAIL')?.trim().toLowerCase();
    const password = config.get<string>('SUPER_ADMIN_PASSWORD');
    const firstName = config.get<string>('SUPER_ADMIN_FIRST_NAME')?.trim();
    const lastName = config.get<string>('SUPER_ADMIN_LAST_NAME')?.trim();

    // 1. Validar que las variables existan
    const missing = [
      ['SUPER_ADMIN_EMAIL', email],
      ['SUPER_ADMIN_PASSWORD', password],
      ['SUPER_ADMIN_FIRST_NAME', firstName],
      ['SUPER_ADMIN_LAST_NAME', lastName],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Faltan variables en .env: ${missing.join(', ')}`);
    }

    // 2. Validar la contraseña con las mismas reglas del API
    //    (aquí no hay ValidationPipe, así que lo hacemos a mano)
    if (
      password!.length < PASSWORD_CONFIG.MIN_LENGTH ||
      !PASSWORD_CONFIG.PATTERN.test(password!)
    ) {
      throw new Error(
        `SUPER_ADMIN_PASSWORD no es válida. Mínimo ${PASSWORD_CONFIG.MIN_LENGTH} caracteres. ` +
        PASSWORD_CONFIG.PATTERN_MESSAGE,
      );
    }

    // 3. ¿Ya existe un usuario con ese email?
    const existing = await usersService.findByEmail(email!);

    if (existing) {
      if (existing.role === UserRole.SUPER_ADMIN) {
        logger.log(`El super admin ${email} ya existe. No hay nada que hacer.`);
        return;
      }

      // No lo promovemos automáticamente: convertir una cuenta existente
      // en super admin es una decisión que debe tomarse a propósito.
      throw new Error(
        `Ya existe un usuario ${email} con rol "${existing.role}". ` +
        'Usa otro email para el super admin.',
      );
    }

    // 4. Crear el super admin con las mismas reglas que el API
    const superAdmin = await usersService.create({
      email: email!,
      password: password!,
      firstName: firstName!,
      lastName: lastName!,
      role: UserRole.SUPER_ADMIN,
      authProvider: AuthProvider.LOCAL,
    });

    logger.log(`✅ Super admin creado: ${superAdmin.email} (${superAdmin._id.toString()})`);
    logger.warn('Ahora borra SUPER_ADMIN_PASSWORD de tu archivo .env');
  } finally {
    // Cerrar la conexión a MongoDB para que el proceso termine
    await app.close();
  }
}

bootstrap().catch((error: Error) => {
  logger.error(error.message);
  process.exitCode = 1;
});
