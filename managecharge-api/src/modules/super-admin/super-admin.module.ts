import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SuperAdminController } from './super-admin.controller.js';
import { SuperAdminService } from './super-admin.service.js';

// ✅ Usar barrel exports
import { Tenant, TenantSchema } from '../tenants/index.js';
import { User, UserSchema } from '../users/index.js';
import { Client, ClientSchema } from '../clients/index.js';
import { Service, ServiceSchema } from '../services/index.js';
import { Payment, PaymentSchema } from '../payments/index.js';

/**
 * Super Admin Module
 * 
 * @description Módulo que agrupa toda la funcionalidad exclusiva
 * del super administrador de ManageCharge. Permite visualizar y
 * gestionar todos los tenants, usuarios, clientes, servicios y pagos
 * de la plataforma.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}