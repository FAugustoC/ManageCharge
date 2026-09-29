import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

import { StripeWebhookAdapter } from './stripe-webhook.adapter';
import {
  InvalidWebhookSignatureError,
  WebhookNotConfiguredError,
} from './webhook.errors';
import { WebhookEventType } from '../../enums/webhook-event-type.enum';

/**
 * Pruebas del adaptador de webhooks de Stripe
 *
 * @description Se usan firmas REALES: Stripe.webhooks.generateTestHeaderString
 * firma el cuerpo igual que lo haría Stripe. Así se prueba la verificación
 * de verdad, no una simulación.
 *
 * Ejecutar: npm test -- stripe-webhook.adapter
 */

const SECRET = 'whsec_test_secret';

/** Crea un adaptador con el secreto indicado (o sin secreto) */
function makeAdapter(secret: string | undefined = SECRET) {
  const configService = {
    get: jest.fn((key: string) =>
      key === 'stripe.webhookSecret' ? secret : undefined,
    ),
  } as unknown as ConfigService;
  return new StripeWebhookAdapter(configService);
}

/** Construye un evento de Stripe, lo convierte a bytes y lo firma */
function signedRequest(
  type: string,
  object: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const payload = JSON.stringify(
    {
      id: 'evt_test_123',
      object: 'event',
      type,
      created: 1_790_000_000,
      livemode: false,
      data: { object, ...extra },
    },
    null,
    2, // con espacios, como los envía Stripe
  );

  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });

  return {
    rawBody: Buffer.from(payload),
    headers: { 'stripe-signature': signature },
  };
}

describe('StripeWebhookAdapter', () => {
  describe('verificación de firma', () => {
    it('acepta un webhook firmado correctamente', () => {
      const adapter = makeAdapter();
      const request = signedRequest('customer.created', { id: 'cus_1' });

      const event = adapter.parseEvent(request);

      expect(event.eventId).toBe('evt_test_123');
      expect(event.provider).toBe('stripe');
      expect(event.livemode).toBe(false);
      expect(event.occurredAt).toEqual(new Date(1_790_000_000 * 1000));
    });

    it('rechaza un cuerpo alterado después de firmarlo', () => {
      const adapter = makeAdapter();
      const request = signedRequest('payment_intent.succeeded', {
        id: 'pi_1',
        amount: 1299,
        currency: 'usd',
      });

      // Alguien cambia el monto en el camino: la firma ya no coincide
      const tampered = request.rawBody.toString().replace('1299', '1');

      expect(() =>
        adapter.parseEvent({ ...request, rawBody: Buffer.from(tampered) }),
      ).toThrow(InvalidWebhookSignatureError);
    });

    it('rechaza el cuerpo re-serializado con JSON.stringify (por eso se necesita rawBody)', () => {
      const adapter = makeAdapter();
      const request = signedRequest('customer.created', { id: 'cus_1' });

      // Mismo contenido, distinto formato (sin espacios): la firma falla
      const reserialized = JSON.stringify(
        JSON.parse(request.rawBody.toString()),
      );

      expect(() =>
        adapter.parseEvent({ ...request, rawBody: Buffer.from(reserialized) }),
      ).toThrow(InvalidWebhookSignatureError);
    });

    it('rechaza una firma hecha con otro secreto', () => {
      const adapter = makeAdapter('whsec_otro_secreto');
      const request = signedRequest('customer.created', { id: 'cus_1' });

      expect(() => adapter.parseEvent(request)).toThrow(
        InvalidWebhookSignatureError,
      );
    });

    it('rechaza si falta el header Stripe-Signature', () => {
      const adapter = makeAdapter();
      const request = signedRequest('customer.created', { id: 'cus_1' });

      expect(() =>
        adapter.parseEvent({ rawBody: request.rawBody, headers: {} }),
      ).toThrow(InvalidWebhookSignatureError);
    });

    it('indica falta de configuración si no hay STRIPE_WEBHOOK_SECRET', () => {
      const adapter = makeAdapter('');
      const request = signedRequest('customer.created', { id: 'cus_1' });

      expect(() => adapter.parseEvent(request)).toThrow(
        WebhookNotConfiguredError,
      );
    });
  });

  describe('traducción de eventos', () => {
    it('payment_intent.succeeded → PAYMENT_SUCCEEDED con monto en unidades completas', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('payment_intent.succeeded', {
          id: 'pi_1',
          object: 'payment_intent',
          amount: 1299,
          currency: 'usd',
          customer: 'cus_1',
          payment_method: 'pm_1',
          metadata: { tenantId: 'tenant_1', plan: 'premium_monthly' },
          last_payment_error: null,
        }),
      );

      expect(event.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);
      expect(event.originalType).toBe('payment_intent.succeeded');
      expect(event.data).toEqual({
        transactionId: 'pi_1',
        customerId: 'cus_1',
        paymentMethodId: 'pm_1',
        tenantId: 'tenant_1',
        amount: 12.99,
        currency: 'USD',
        errorCode: undefined,
        errorMessage: undefined,
      });
    });

    it('respeta monedas sin decimales (CLP)', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('payment_intent.succeeded', {
          id: 'pi_2',
          amount: 12000,
          currency: 'clp',
          metadata: {},
        }),
      );

      expect(event.data.amount).toBe(12000);
      expect(event.data.currency).toBe('CLP');
    });

    it('payment_intent.payment_failed → PAYMENT_FAILED con el motivo del rechazo', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('payment_intent.payment_failed', {
          id: 'pi_3',
          amount: 10000,
          currency: 'gtq',
          customer: { id: 'cus_expandido' }, // campo "expandido" → objeto
          metadata: { tenantId: 'tenant_1' },
          last_payment_error: {
            code: 'card_declined',
            decline_code: 'insufficient_funds',
            message: 'Your card has insufficient funds.',
          },
        }),
      );

      expect(event.type).toBe(WebhookEventType.PAYMENT_FAILED);
      expect(event.data.customerId).toBe('cus_expandido');
      expect(event.data.amount).toBe(100);
      expect(event.data.errorCode).toBe('insufficient_funds');
      expect(event.data.errorMessage).toBe('Your card has insufficient funds.');
    });

    it('charge.refunded → PAYMENT_REFUNDED usando el ID del PaymentIntent', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('charge.refunded', {
          id: 'ch_1',
          payment_intent: 'pi_1',
          customer: 'cus_1',
          amount: 1299,
          amount_refunded: 500,
          currency: 'usd',
          metadata: { tenantId: 'tenant_1' },
        }),
      );

      expect(event.type).toBe(WebhookEventType.PAYMENT_REFUNDED);
      expect(event.data.transactionId).toBe('pi_1');
      expect(event.data.amount).toBe(5);
    });

    it('charge.dispute.created → PAYMENT_DISPUTED con el motivo', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('charge.dispute.created', {
          id: 'dp_1',
          charge: 'ch_1',
          payment_intent: 'pi_1',
          amount: 1299,
          currency: 'usd',
          reason: 'fraudulent',
          metadata: {},
        }),
      );

      expect(event.type).toBe(WebhookEventType.PAYMENT_DISPUTED);
      expect(event.data.transactionId).toBe('pi_1');
      expect(event.data.errorCode).toBe('fraudulent');
    });

    it('payment_method.automatically_updated → PAYMENT_METHOD_UPDATED con la tarjeta nueva', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('payment_method.automatically_updated', {
          id: 'pm_1',
          customer: 'cus_1',
          card: { last4: '4242', brand: 'visa', exp_month: 12, exp_year: 2030 },
        }),
      );

      expect(event.type).toBe(WebhookEventType.PAYMENT_METHOD_UPDATED);
      expect(event.data.card).toEqual({
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2030,
      });
    });

    it('payment_method.detached → toma el cliente de previous_attributes', () => {
      const event = makeAdapter().parseEvent(
        signedRequest(
          'payment_method.detached',
          { id: 'pm_1', customer: null, card: null },
          { previous_attributes: { customer: 'cus_1' } },
        ),
      );

      expect(event.type).toBe(WebhookEventType.PAYMENT_METHOD_DETACHED);
      expect(event.data.customerId).toBe('cus_1');
      expect(event.data.card).toBeUndefined();
    });

    it('un evento que no nos interesa se traduce con type null', () => {
      const event = makeAdapter().parseEvent(
        signedRequest('customer.created', { id: 'cus_1' }),
      );

      expect(event.type).toBeNull();
      expect(event.data).toEqual({});
    });
  });
});
