import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import request from 'supertest';
import type { App } from 'supertest/types';

import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookEvent } from './entities/index';
import { WEBHOOK_ADAPTERS } from '../../common/index';
import { StripeWebhookAdapter } from '../../common/providers/webhooks/index';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Prueba HTTP del endpoint de webhooks (de punta a punta, sin MongoDB)
 *
 * @description Levanta una app Nest real, con:
 * - rawBody: true (igual que main.ts)
 * - el guard global de JWT (igual que app.module.ts)
 * y le envía peticiones HTTP como lo haría Stripe. Comprueba que:
 * - la ruta es pública pese al guard de JWT (@Public)
 * - la firma se verifica con los bytes crudos
 * - responde 200 (no el 201 que Nest usa por defecto en POST)
 *
 * Ejecutar: npm test -- webhooks.controller
 */

const SECRET = 'whsec_test_secret';

describe('POST /webhooks/:provider', () => {
  let app: INestApplication<App>;
  let model: Record<string, jest.Mock>;

  beforeAll(async () => {
    model = {
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        WebhooksService,
        StripeWebhookAdapter,
        {
          provide: WEBHOOK_ADAPTERS,
          useFactory: (stripe: StripeWebhookAdapter) => [stripe],
          inject: [StripeWebhookAdapter],
        },
        { provide: getModelToken(WebhookEvent.name), useValue: model },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'stripe.webhookSecret' ? SECRET : undefined,
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => jest.clearAllMocks());

  const payload = JSON.stringify(
    {
      id: 'evt_http_1',
      object: 'event',
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'pi_1',
          amount: 1299,
          currency: 'usd',
          metadata: { tenantId: 't1' },
        },
      },
    },
    null,
    2,
  );

  it('acepta un webhook firmado sin JWT y responde 200', async () => {
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: SECRET,
    });

    const response = await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, duplicate: false });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_http_1' }),
    );
  });

  it('responde 400 con una firma falsa', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=123,v1=firma_falsa')
      .send(payload);

    expect(response.status).toBe(400);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('responde 404 para un proveedor desconocido', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/paypal')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(404);
  });
});
