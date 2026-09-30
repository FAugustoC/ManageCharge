import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Model } from 'mongoose';

import { WebhooksService } from './webhooks.service';
import { WebhookEventDocument } from './entities/index';
import { SubscriptionsWebhookHandler } from '../subscriptions/index';
import {
  PaymentProvider,
  WebhookEventStatus,
  WebhookEventType,
} from '../../common/index';
import type {
  IWebhookAdapter,
  NormalizedWebhookEvent,
} from '../../common/index';
import {
  InvalidWebhookSignatureError,
  WebhookNotConfiguredError,
  WebhookRetryLaterError,
} from '../../common/providers/webhooks/index';

/**
 * Pruebas del WebhooksService (con dependencias simuladas)
 *
 * @description MongoDB y el adaptador se reemplazan por objetos falsos
 * para verificar las reglas del servicio:
 * - Cada evento se procesa UNA sola vez (idempotencia)
 * - Un evento que falló se puede reintentar
 * - Los errores se traducen al código HTTP correcto para el proveedor
 * - Cada tipo de evento llega a su regla de negocio
 *
 * Ejecutar: npm test -- webhooks.service
 */

const REQUEST = { rawBody: Buffer.from('{}'), headers: {} };

function makeEvent(
  overrides: Partial<NormalizedWebhookEvent> = {},
): NormalizedWebhookEvent {
  return {
    provider: PaymentProvider.STRIPE,
    eventId: 'evt_1',
    originalType: 'payment_intent.succeeded',
    type: WebhookEventType.PAYMENT_SUCCEEDED,
    occurredAt: new Date('2026-09-28T12:00:00Z'),
    livemode: false,
    data: { transactionId: 'pi_1', amount: 12.99, currency: 'USD' },
    ...overrides,
  };
}

/** Error igual al que lanza MongoDB al violar el índice único */
const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), {
  code: 11000,
});

describe('WebhooksService', () => {
  let service: WebhooksService;
  let adapter: { provider: PaymentProvider; parseEvent: jest.Mock };
  let model: Record<string, jest.Mock>;
  let handler: Record<string, jest.Mock>;

  beforeEach(() => {
    adapter = {
      provider: PaymentProvider.STRIPE,
      parseEvent: jest.fn().mockReturnValue(makeEvent()),
    };

    model = {
      create: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({}),
    };

    // Reglas de negocio simuladas: por defecto "se aplicó una acción"
    handler = {
      handlePaymentSucceeded: jest.fn().mockResolvedValue(true),
      handlePaymentFailed: jest.fn().mockResolvedValue(false),
      handlePaymentRefunded: jest.fn().mockResolvedValue(true),
      handlePaymentDisputed: jest.fn().mockResolvedValue(true),
      handlePaymentMethodUpdated: jest.fn().mockResolvedValue(true),
      handlePaymentMethodDetached: jest.fn().mockResolvedValue(true),
    };

    service = new WebhooksService(
      model as unknown as Model<WebhookEventDocument>,
      [adapter as IWebhookAdapter],
      handler as unknown as SubscriptionsWebhookHandler,
    );
  });

  /** Estado con el que se marcó el evento al terminar */
  const finalStatus = (): string => {
    const calls = model.updateOne.mock.calls as [
      unknown,
      { $set: { status: string } },
    ][];
    return calls[calls.length - 1][1].$set.status;
  };

  describe('verificación y enrutamiento', () => {
    it('responde 404 si el proveedor no existe', async () => {
      await expect(service.handle('paypal', REQUEST)).rejects.toThrow(
        NotFoundException,
      );
      expect(model.create).not.toHaveBeenCalled();
    });

    it('responde 400 si la firma es inválida y no guarda nada', async () => {
      adapter.parseEvent.mockImplementation(() => {
        throw new InvalidWebhookSignatureError('No signatures found');
      });

      await expect(service.handle('stripe', REQUEST)).rejects.toThrow(
        BadRequestException,
      );
      expect(model.create).not.toHaveBeenCalled();
    });

    it('responde 503 si falta el secreto (el proveedor reintentará)', async () => {
      adapter.parseEvent.mockImplementation(() => {
        throw new WebhookNotConfiguredError(
          'STRIPE_WEBHOOK_SECRET no está configurado',
        );
      });

      await expect(service.handle('stripe', REQUEST)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('idempotencia', () => {
    it('un evento nuevo se registra y se marca como terminado', async () => {
      const result = await service.handle('stripe', REQUEST);

      expect(result).toEqual({ received: true, duplicate: false });
      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'stripe',
          eventId: 'evt_1',
          status: WebhookEventStatus.PROCESSING,
        }),
      );
      // La regla de negocio aplicó una acción → "processed"
      expect(finalStatus()).toBe(WebhookEventStatus.PROCESSED);
    });

    it('un evento sin interés (type null) se marca como ignorado', async () => {
      adapter.parseEvent.mockReturnValue(
        makeEvent({ type: null, originalType: 'customer.created', data: {} }),
      );

      await service.handle('stripe', REQUEST);

      expect(finalStatus()).toBe(WebhookEventStatus.IGNORED);
      expect(handler.handlePaymentSucceeded).not.toHaveBeenCalled();
    });

    it('si la regla no requirió acción, el evento queda como ignorado', async () => {
      handler.handlePaymentSucceeded.mockResolvedValue(false);

      await service.handle('stripe', REQUEST);

      expect(finalStatus()).toBe(WebhookEventStatus.IGNORED);
    });

    it('un evento ya procesado NO se vuelve a procesar', async () => {
      model.create.mockRejectedValue(duplicateKeyError);
      model.findOne.mockResolvedValue({ status: WebhookEventStatus.PROCESSED });

      const result = await service.handle('stripe', REQUEST);

      expect(result).toEqual({ received: true, duplicate: true });
      expect(model.updateOne).not.toHaveBeenCalled();
      expect(handler.handlePaymentSucceeded).not.toHaveBeenCalled();
    });

    it('un evento que falló antes se retoma y suma un intento', async () => {
      model.create.mockRejectedValue(duplicateKeyError);
      model.findOneAndUpdate.mockResolvedValue({ attempts: 2 });

      const result = await service.handle('stripe', REQUEST);

      expect(result.duplicate).toBe(false);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'stripe', eventId: 'evt_1' }),
        expect.objectContaining({ $inc: { attempts: 1 } }),
        { new: true },
      );
      expect(finalStatus()).toBe(WebhookEventStatus.PROCESSED);
    });

    it('responde 409 si otra petición lo está procesando ahora mismo', async () => {
      model.create.mockRejectedValue(duplicateKeyError);
      model.findOne.mockResolvedValue({
        status: WebhookEventStatus.PROCESSING,
      });

      await expect(service.handle('stripe', REQUEST)).rejects.toThrow(
        ConflictException,
      );
      expect(model.updateOne).not.toHaveBeenCalled();
    });

    it('un error de MongoDB distinto al duplicado no se oculta', async () => {
      model.create.mockRejectedValue(new Error('Mongo caído'));

      await expect(service.handle('stripe', REQUEST)).rejects.toThrow(
        'Mongo caído',
      );
    });
  });

  describe('despacho a las reglas de negocio', () => {
    it.each([
      [WebhookEventType.PAYMENT_SUCCEEDED, 'handlePaymentSucceeded'],
      [WebhookEventType.PAYMENT_FAILED, 'handlePaymentFailed'],
      [WebhookEventType.PAYMENT_REFUNDED, 'handlePaymentRefunded'],
      [WebhookEventType.PAYMENT_DISPUTED, 'handlePaymentDisputed'],
      [WebhookEventType.PAYMENT_METHOD_UPDATED, 'handlePaymentMethodUpdated'],
      [WebhookEventType.PAYMENT_METHOD_DETACHED, 'handlePaymentMethodDetached'],
    ])('%s → %s', async (type, method) => {
      const event = makeEvent({ type });
      adapter.parseEvent.mockReturnValue(event);

      await service.handle('stripe', REQUEST);

      expect(handler[method]).toHaveBeenCalledWith(event);
      // Ninguna otra regla se ejecuta
      const others = Object.keys(handler).filter((name) => name !== method);
      others.forEach((name) => expect(handler[name]).not.toHaveBeenCalled());
    });
  });

  describe('errores al procesar', () => {
    it('si la regla pide esperar, marca FAILED y responde 409 (sin ERROR en logs)', async () => {
      handler.handlePaymentSucceeded.mockRejectedValue(
        new WebhookRetryLaterError('Cobro aún sin registro local'),
      );

      await expect(service.handle('stripe', REQUEST)).rejects.toThrow(
        ConflictException,
      );
      expect(model.updateOne).toHaveBeenCalledWith(
        { provider: 'stripe', eventId: 'evt_1' },
        {
          $set: {
            status: WebhookEventStatus.FAILED,
            lastError: 'Cobro aún sin registro local',
          },
        },
      );
    });

    it('si la regla de negocio falla, marca FAILED y responde 500 para que se reintente', async () => {
      handler.handlePaymentSucceeded.mockRejectedValue(
        new Error('Tenant no encontrado'),
      );

      await expect(service.handle('stripe', REQUEST)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(model.updateOne).toHaveBeenCalledWith(
        { provider: 'stripe', eventId: 'evt_1' },
        {
          $set: {
            status: WebhookEventStatus.FAILED,
            lastError: 'Tenant no encontrado',
          },
        },
      );
    });
  });
});
