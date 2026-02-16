// src/modules/subscriptions/subscriptions.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { SubscriptionsScheduler } from './subscriptions.scheduler.js';

// Entities
import { Tenant, TenantSchema } from '../tenants/index.js';
import {
  SubscriptionTransaction,
  SubscriptionTransactionSchema,
} from './entities/index.js';

// Providers
import { StripeProvider } from '../../common/providers/payment/index.js';

/**
 * SubscriptionsModule
 *
 * @description Módulo que gestiona todo el ciclo de vida
 * de las suscripciones de ManageCharge:
 * - Contratación de planes
 * - Renovación automática
 * - Gestión de pagos
 * - Downgrade automático
 */
@Module({
  imports: [
    // Registro de modelos de MongoDB
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      {
        name: SubscriptionTransaction.name,
        schema: SubscriptionTransactionSchema,
      },
    ]),

    // Módulo de scheduler para cron jobs
    ScheduleModule.forRoot(),

    // Módulo de configuración para acceder a variables de entorno
    ConfigModule,
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionsScheduler,
    StripeProvider, // Provider de Stripe
  ],
  exports: [
    SubscriptionsService, // Exportar para uso en otros módulos
  ],
})
export class SubscriptionsModule {}