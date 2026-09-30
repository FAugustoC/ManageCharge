import { Model, Types } from 'mongoose';

import { SubscriptionsWebhookHandler } from './subscriptions.webhook-handler';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionTransactionDocument } from './entities/index';
import { TenantDocument } from '../tenants/index';
import {
  PaymentProvider,
  SubscriptionPlan,
  SubscriptionStatus,
  TransactionStatus,
  TransactionType,
  WebhookEventType,
} from '../../common/index';
import type { NormalizedWebhookEvent } from '../../common/index';
import { WebhookRetryLaterError } from '../../common/providers/webhooks/index';

/**
 * Pruebas de las reglas de negocio de los webhooks de suscripciones
 *
 * @description MongoDB y SubscriptionsService se reemplazan por objetos
 * falsos. Se verifican las reglas decididas para ManageCharge:
 * - Cobro huérfano: renovar si sigue vencido; si ya estaba al día,
 *   marcar como posible doble cobro y alertar
 * - Reembolso total y disputa: degradar a FREE (salvo doble cobro)
 * - Tarjeta actualizada o desvinculada
 *
 * Ejecutar: npm test -- subscriptions.webhook-handler
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-29T15:00:00Z');
const TENANT_ID = new Types.ObjectId();

function makeTenant(subscription: Record<string, unknown> = {}) {
  return {
    _id: TENANT_ID,
    email: 'tenant@test.com',
    subscription: {
      plan: SubscriptionPlan.PREMIUM_MONTHLY,
      status: SubscriptionStatus.GRACE_PERIOD,
      amount: 100,
      currency: 'GTQ',
      currentPeriodStart: new Date(NOW.getTime() - 33 * DAY),
      currentPeriodEnd: new Date(NOW.getTime() - 3 * DAY), // vencido hace 3 días
      paymentMethod: { paymentMethodId: 'pm_1', last4: '4242' },
      ...subscription,
    },
  };
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    tenantId: TENANT_ID,
    type: TransactionType.RENEWAL,
    status: TransactionStatus.SUCCESS,
    amount: 100,
    currency: 'GTQ',
    possibleDuplicate: false,
    ...overrides,
  };
}

function makeEvent(
  type: WebhookEventType,
  data: NormalizedWebhookEvent['data'] = {},
  occurredAt = new Date(NOW.getTime() - 60 * 60 * 1000), // hace 1 hora
): NormalizedWebhookEvent {
  return {
    provider: PaymentProvider.STRIPE,
    eventId: 'evt_1',
    originalType: 'test',
    type,
    occurredAt,
    livemode: false,
    data,
  };
}

/** Cobro exitoso de una renovación de 100 GTQ */
const succeeded = (occurredAt?: Date) =>
  makeEvent(
    WebhookEventType.PAYMENT_SUCCEEDED,
    {
      transactionId: 'pi_1',
      amount: 100,
      currency: 'GTQ',
      metadata: { tenantId: TENANT_ID.toString(), type: 'renewal' },
    },
    occurredAt,
  );

describe('SubscriptionsWebhookHandler', () => {
  let handler: SubscriptionsWebhookHandler;
  let tenantModel: Record<string, jest.Mock>;
  let transactionModel: Record<string, jest.Mock>;
  let subscriptions: Record<string, jest.Mock>;
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);

    tenantModel = {
      findById: jest.fn().mockResolvedValue(makeTenant()),
      findOne: jest.fn().mockResolvedValue(null),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    };
    transactionModel = {
      findOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    subscriptions = {
      renewSubscription: jest.fn().mockResolvedValue(true),
      downgradeToFree: jest.fn().mockResolvedValue(undefined),
      createTransaction: jest.fn().mockResolvedValue(undefined),
    };

    handler = new SubscriptionsWebhookHandler(
      tenantModel as unknown as Model<TenantDocument>,
      transactionModel as unknown as Model<SubscriptionTransactionDocument>,
      subscriptions as unknown as SubscriptionsService,
    );

    // Espiar las alertas al administrador (siguen apareciendo en consola)
    alertSpy = jest.spyOn(
      handler as unknown as { alertAdmin: () => void },
      'alertAdmin',
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Datos con los que se creó la transacción */
  const createdTransaction = (): Record<string, unknown> => {
    const calls = subscriptions.createTransaction.mock.calls as [
      Record<string, unknown>,
    ][];
    return calls[0][0];
  };

  describe('cobro exitoso', () => {
    it('si ya estaba registrado, no hace nada', async () => {
      transactionModel.findOne.mockResolvedValue(makeTransaction());

      await expect(handler.handlePaymentSucceeded(succeeded())).resolves.toBe(
        false,
      );
      expect(subscriptions.renewSubscription).not.toHaveBeenCalled();
      expect(subscriptions.createTransaction).not.toHaveBeenCalled();
    });

    it('si es reciente y no hay registro, pide esperar (nuestro flujo aún lo guarda)', async () => {
      const recent = succeeded(new Date(NOW.getTime() - 30 * 1000)); // hace 30s

      await expect(handler.handlePaymentSucceeded(recent)).rejects.toThrow(
        WebhookRetryLaterError,
      );
      expect(subscriptions.renewSubscription).not.toHaveBeenCalled();
    });

    it('cobro huérfano con tenant en gracia → renueva y registra la transacción', async () => {
      const tenant = makeTenant();
      tenantModel.findById.mockResolvedValue(tenant);

      await expect(handler.handlePaymentSucceeded(succeeded())).resolves.toBe(
        true,
      );

      // Renovación protegida: solo si el período sigue siendo el que se leyó
      expect(subscriptions.renewSubscription).toHaveBeenCalledWith(
        tenant,
        'pi_1',
        {
          onlyIfPeriodEnd: tenant.subscription.currentPeriodEnd,
        },
      );
      expect(createdTransaction()).toEqual(
        expect.objectContaining({
          type: TransactionType.RENEWAL,
          status: TransactionStatus.SUCCESS,
          providerTransactionId: 'pi_1',
          amount: 100,
          possibleDuplicate: false,
          requiresReview: false,
        }),
      );
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('tenant ya al día → NO renueva, marca posible doble cobro y alerta', async () => {
      tenantModel.findById.mockResolvedValue(
        makeTenant({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(NOW.getTime() + 27 * DAY),
        }),
      );

      await expect(handler.handlePaymentSucceeded(succeeded())).resolves.toBe(
        true,
      );

      expect(subscriptions.renewSubscription).not.toHaveBeenCalled();
      expect(createdTransaction()).toEqual(
        expect.objectContaining({
          status: TransactionStatus.SUCCESS,
          possibleDuplicate: true,
          requiresReview: true,
          reviewReason: expect.stringContaining(
            'Posible doble cobro',
          ) as string,
        }),
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Posible doble cobro',
        expect.any(String),
      );
    });

    it('si otro proceso renovó en el mismo instante → posible doble cobro', async () => {
      subscriptions.renewSubscription.mockResolvedValue(false);

      await handler.handlePaymentSucceeded(succeeded());

      expect(createdTransaction()).toEqual(
        expect.objectContaining({
          possibleDuplicate: true,
          reviewReason: expect.stringContaining('otro proceso') as string,
        }),
      );
    });

    it('monto distinto al del plan → no renueva, pide revisión (no es doble cobro)', async () => {
      tenantModel.findById.mockResolvedValue(makeTenant({ amount: 250 }));

      await handler.handlePaymentSucceeded(succeeded());

      expect(subscriptions.renewSubscription).not.toHaveBeenCalled();
      expect(createdTransaction()).toEqual(
        expect.objectContaining({
          possibleDuplicate: false,
          requiresReview: true,
          reviewReason: expect.stringContaining('monto') as string,
        }),
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Cobro exitoso sin aplicar',
        expect.any(String),
      );
    });

    it('si nuestro flujo lo registró como FAILED pero el proveedor lo completó, corrige ese registro', async () => {
      const failed = makeTransaction({ status: TransactionStatus.FAILED });
      transactionModel.findOne.mockResolvedValue(failed);
      // Aunque sea reciente: si ya existe el registro, no hay que esperar
      const recent = succeeded(new Date(NOW.getTime() - 30 * 1000));

      await expect(handler.handlePaymentSucceeded(recent)).resolves.toBe(true);

      expect(subscriptions.renewSubscription).toHaveBeenCalled();
      expect(subscriptions.createTransaction).not.toHaveBeenCalled();
      expect(transactionModel.updateOne).toHaveBeenCalledWith(
        { _id: failed._id },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: TransactionStatus.SUCCESS,
          }) as object,
          $unset: { errorCode: '', errorMessage: '' },
        }),
      );
    });

    it('sin tenant identificable → alerta y no hace nada más', async () => {
      const event = makeEvent(WebhookEventType.PAYMENT_SUCCEEDED, {
        transactionId: 'pi_1',
        amount: 100,
        currency: 'GTQ',
      });

      await expect(handler.handlePaymentSucceeded(event)).resolves.toBe(false);
      expect(tenantModel.findById).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('reembolso', () => {
    const refunded = (amount: number) =>
      makeEvent(WebhookEventType.PAYMENT_REFUNDED, {
        transactionId: 'pi_1',
        amount,
        currency: 'GTQ',
      });

    it('parcial → guarda el monto, NO degrada', async () => {
      transactionModel.findOne.mockResolvedValue(makeTransaction());

      await expect(handler.handlePaymentRefunded(refunded(40))).resolves.toBe(
        true,
      );

      expect(transactionModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: { refundedAmount: 40 },
        },
      );
      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();
    });

    it('total → marca REFUNDED y degrada a FREE', async () => {
      transactionModel.findOne.mockResolvedValue(makeTransaction());

      await handler.handlePaymentRefunded(refunded(100));

      expect(transactionModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: { refundedAmount: 100, status: TransactionStatus.REFUNDED },
        },
      );
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(
        expect.anything(),
        'payment_refunded',
      );
    });

    it('reembolsos que llegan en desorden → conserva el mayor acumulado', async () => {
      transactionModel.findOne.mockResolvedValue(
        makeTransaction({ refundedAmount: 70 }),
      );

      await handler.handlePaymentRefunded(refunded(40)); // evento viejo

      expect(transactionModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: { refundedAmount: 70 },
        },
      );
    });

    it('reembolso total de un posible doble cobro → NO degrada y cierra la revisión', async () => {
      transactionModel.findOne.mockResolvedValue(
        makeTransaction({
          possibleDuplicate: true,
          reviewReason: 'Posible doble cobro',
        }),
      );

      await handler.handlePaymentRefunded(refunded(100));

      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();
      expect(transactionModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: expect.objectContaining({
            requiresReview: false,
            reviewReason: expect.stringContaining('Resuelto') as string,
          }) as object,
        },
      );
    });

    it('si el tenant ya es FREE, no lo vuelve a degradar', async () => {
      transactionModel.findOne.mockResolvedValue(makeTransaction());
      tenantModel.findById.mockResolvedValue(
        makeTenant({ plan: SubscriptionPlan.FREE }),
      );

      await handler.handlePaymentRefunded(refunded(100));

      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();
    });

    it('de un cobro desconocido → alerta y no hace nada', async () => {
      await expect(handler.handlePaymentRefunded(refunded(100))).resolves.toBe(
        false,
      );
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('disputa', () => {
    const disputed = makeEvent(WebhookEventType.PAYMENT_DISPUTED, {
      transactionId: 'pi_1',
      amount: 100,
      currency: 'GTQ',
      errorCode: 'fraudulent',
    });

    it('marca la disputa, degrada a FREE y alerta', async () => {
      transactionModel.findOne.mockResolvedValue(makeTransaction());

      await expect(handler.handlePaymentDisputed(disputed)).resolves.toBe(true);

      expect(transactionModel.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        {
          $set: expect.objectContaining({
            disputedAt: disputed.occurredAt,
            disputeReason: 'fraudulent',
            requiresReview: true,
          }) as object,
        },
      );
      expect(subscriptions.downgradeToFree).toHaveBeenCalledWith(
        expect.anything(),
        'payment_disputed',
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Disputa abierta',
        expect.any(String),
      );
    });

    it('disputa de un posible doble cobro → alerta pero NO degrada', async () => {
      transactionModel.findOne.mockResolvedValue(
        makeTransaction({ possibleDuplicate: true }),
      );

      await handler.handlePaymentDisputed(disputed);

      expect(subscriptions.downgradeToFree).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('métodos de pago', () => {
    it('tarjeta actualizada por el banco → actualiza los datos del tenant', async () => {
      tenantModel.findOneAndUpdate.mockResolvedValue(makeTenant());
      const event = makeEvent(WebhookEventType.PAYMENT_METHOD_UPDATED, {
        paymentMethodId: 'pm_1',
        card: {
          last4: '1111',
          brand: 'visa',
          expiryMonth: 1,
          expiryYear: 2031,
        },
      });

      await expect(handler.handlePaymentMethodUpdated(event)).resolves.toBe(
        true,
      );

      expect(tenantModel.findOneAndUpdate).toHaveBeenCalledWith(
        { 'subscription.paymentMethod.paymentMethodId': 'pm_1' },
        {
          $set: {
            'subscription.paymentMethod.last4': '1111',
            'subscription.paymentMethod.brand': 'visa',
            'subscription.paymentMethod.expiryMonth': 1,
            'subscription.paymentMethod.expiryYear': 2031,
          },
        },
      );
    });

    it('tarjeta que no pertenece a ningún tenant → no hace nada', async () => {
      const event = makeEvent(WebhookEventType.PAYMENT_METHOD_UPDATED, {
        paymentMethodId: 'pm_otro',
        card: { last4: '1111' },
      });

      await expect(handler.handlePaymentMethodUpdated(event)).resolves.toBe(
        false,
      );
    });

    it('se desvinculó la tarjeta ACTUAL de un tenant → alerta', async () => {
      tenantModel.findOne.mockResolvedValue(makeTenant());
      const event = makeEvent(WebhookEventType.PAYMENT_METHOD_DETACHED, {
        paymentMethodId: 'pm_1',
      });

      await expect(handler.handlePaymentMethodDetached(event)).resolves.toBe(
        true,
      );
      expect(alertSpy).toHaveBeenCalledWith(
        'Tarjeta desvinculada en el proveedor',
        expect.any(String),
      );
    });

    it('se desvinculó una tarjeta vieja (el tenant ya la reemplazó) → nada', async () => {
      const event = makeEvent(WebhookEventType.PAYMENT_METHOD_DETACHED, {
        paymentMethodId: 'pm_vieja',
      });

      await expect(handler.handlePaymentMethodDetached(event)).resolves.toBe(
        false,
      );
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});
