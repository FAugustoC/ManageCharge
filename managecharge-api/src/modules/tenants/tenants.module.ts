import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './entities/index.js';
import { TenantsService } from './tenants.service.js';
import { TenantsController } from './tenants.controller.js';

/**
 * TenantsModule
 * 
 * @description Módulo que encapsula toda la funcionalidad
 * relacionada con los Tenants (empresas/freelancers).
 * 
 * Componentes:
 * - Entity: Tenant (schema de MongoDB)
 * - Service: TenantsService (lógica de negocio)
 * - Controller: TenantsController (endpoints REST)
 */
@Module({
  imports: [
    /**
     * MongooseModule.forFeature()
     * 
     * Registra los schemas de Mongoose que usará este módulo.
     * Esto permite inyectar el modelo en los servicios con @InjectModel()
     */
    MongooseModule.forFeature([
      {
        name: Tenant.name,    // Nombre del modelo: 'Tenant'
        schema: TenantSchema, // Schema de Mongoose
      },
    ]),
  ],
  controllers: [
    TenantsController, // Controlador que maneja las rutas /tenants
  ],
  providers: [
    TenantsService, // Servicio con la lógica de negocio
  ],
  exports: [
    TenantsService, // Exportamos el servicio para usarlo en otros módulos
  ],
})
export class TenantsModule {}