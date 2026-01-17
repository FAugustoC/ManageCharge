import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from './entities/index.js';
import { ServicesService } from './services.service.js';
import { ServicesController } from './services.controller.js';
import { ClientsModule } from '../clients/index.js';

/**
 * ServicesModule
 * 
 * @description Módulo que encapsula toda la funcionalidad
 * relacionada con los Services (contratos/servicios).
 * 
 * Dependencias:
 * - ClientsModule: Para verificar que el cliente existe
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Service.name,
        schema: ServiceSchema,
      },
    ]),
    ClientsModule,
  ],
  controllers: [
    ServicesController,
  ],
  providers: [
    ServicesService,
  ],
  exports: [
    ServicesService,
  ],
})
export class ServicesModule {}