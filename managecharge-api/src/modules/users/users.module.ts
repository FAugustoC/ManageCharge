import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/index.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

/**
 * UsersModule
 * 
 * @description Módulo que encapsula toda la funcionalidad
 * relacionada con los Users (usuarios del sistema).
 * 
 * Componentes:
 * - Entity: User (schema de MongoDB)
 * - Service: UsersService (lógica de negocio)
 * - Controller: UsersController (endpoints REST)
 */
@Module({
  imports: [
    /**
     * Registra el schema de User para este módulo
     */
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  controllers: [
    UsersController,
  ],
  providers: [
    UsersService,
  ],
  exports: [
    UsersService, // Exportamos para que AuthModule pueda usarlo
  ],
})
export class UsersModule {}