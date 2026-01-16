import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from './entities/index.js';
import { ClientsService } from './clients.service.js';
import { ClientsController } from './clients.controller.js';

/**
 * ClientsModule
 * 
 * @description Módulo que encapsula toda la funcionalidad
 * relacionada con los Clients (clientes de cada tenant).
 * 
 * Componentes:
 * - Entity: Client (schema de MongoDB)
 * - Service: ClientsService (lógica de negocio)
 * - Controller: ClientsController (endpoints REST)
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Client.name,
        schema: ClientSchema,
      },
    ]),
  ],
  controllers: [
    ClientsController,
  ],
  providers: [
    ClientsService,
  ],
  exports: [
    ClientsService, // Exportamos para usar en otros módulos (ej: ServicesModule)
  ],
})
export class ClientsModule {}