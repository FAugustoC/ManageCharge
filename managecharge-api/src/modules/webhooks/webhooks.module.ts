// src/modules/webhooks/webhooks.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { WebhookEvent, WebhookEventSchema } from './entities/index.js';
import { SubscriptionsModule } from '../subscriptions/index.js';
import { WEBHOOK_ADAPTERS } from '../../common/index.js';
import type { IWebhookAdapter } from '../../common/index.js';
import { StripeWebhookAdapter } from '../../common/providers/webhooks/index.js';

/**
 * WebhooksModule
 *
 * @description Recibe y procesa los webhooks de los proveedores de pago.
 *
 * Registro de adaptadores: WEBHOOK_ADAPTERS es la lista de proveedores
 * soportados. Para agregar CyberSource solo se crea su adaptador y se
 * agrega a esta lista; el controlador y el servicio no cambian.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
    ConfigModule,
    // Aporta SubscriptionsWebhookHandler (las reglas de negocio)
    SubscriptionsModule,
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    StripeWebhookAdapter,
    {
      provide: WEBHOOK_ADAPTERS,
      useFactory: (stripe: StripeWebhookAdapter): IWebhookAdapter[] => [stripe],
      inject: [StripeWebhookAdapter],
    },
  ],
})
export class WebhooksModule {}
