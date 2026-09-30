import { Types } from 'mongoose';

import { SubscriptionsService } from './subscriptions.service';
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../common/enums/index';

/**
 * Pruebas de integración del SubscriptionsService (con dependencias simuladas)
 *
 * @description MongoDB y Stripe se reemplazan por objetos falsos para
 * verificar que el servicio APLICA correctamente las reglas de negocio:
 * - Un período nuevo empieza al vencer el anterior (sin días gratis)
 * - El cron cobra solo en los días del calendario, en horario 8am-8pm local
 * - El downgrade se decide por días de gracia transcurridos
 *
 * Ejecutar: npm test -- subscriptions.service
 */

const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 15;
const RETRY_SCHEDULE = [1, 2, 4, 6, 9, 12, 15];

/** Crea un tenant falso con suscripción premium mensual */
function makeTenant(subscription: Record<string, unknown>) {
  return {
    _id: new Types.ObjectId(),
    email: 'tenant@test.com',
    name: 'Tenant',
    slug: 'tenant',
    address: { country: 'GT' },
    settings: { timezone: 'America/Guatemala' },
    subscription: {
      plan: SubscriptionPlan.PREMIUM_MONTHLY,
      status: SubscriptionStatus.ACTIVE,
      autoRenew: true,
      retryAttempts: 0,
      amount: 100,
      currency: 'GTQ',
      subscriptionHistory: [],
      paymentMethod: {
        provider: 'stripe',
        customerId: 'cus_test',
        paymentMethodId: 'pm_test',
      },
      ...subscription,
    },
  };
}

describe('SubscriptionsService - reglas de facturación', () => {
  let service: SubscriptionsService;
  let tenantModel: Record<string, jest.Mock>;
  let stripeProvider: Record<string, jest.Mock>;
  let findResults: unknown[][];

  beforeEach(() => {
    // Cada llamada a tenantModel.find() devuelve el siguiente resultado de la lista
    findResults = [];
    tenantModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue(findResults.shift() ?? []),
      })),
    };

    // El modelo de transacciones se usa con "new", por eso es una función constructora
    const transactionModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({}),
    }));

    stripeProvider = {
      createCustomer: jest.fn().mockResolvedValue('cus_test'),
      savePaymentMethod: jest.fn().mockResolvedValue({
        provider: 'stripe',
        customerId: 'cus_test',
        paymentMethodId: 'pm_new',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2030,
      }),
      charge: jest.fn().mockResolvedValue({ success: true, transactionId: 'pi_1' }),
    };

    const config: Record<string, unknown> = {
      'subscriptions.retryMaxAttempts': RETRY_SCHEDULE.length,
      'subscriptions.retryScheduleDays': RETRY_SCHEDULE,
      'subscriptions.gracePeriodDays': GRACE_DAYS,
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => config[key]),
      get: jest.fn((key: string) => config[key]),
    };

    service = new SubscriptionsService(
      tenantModel as never,
      transactionModel as never,
      stripeProvider as never,
      configService as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  /** Devuelve el objeto "subscription" que el servicio intentó guardar */
  const savedSubscription = () =>
    tenantModel.findByIdAndUpdate.mock.calls[0][1].$set.subscription;

  // ------------------------------------------------------------
  describe('subscribe()', () => {
    it('en el día 7 de gracia, el nuevo mes empieza en el vencimiento anterior', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-08T14:00:00Z'));
      const oldEnd = new Date('2026-03-01T15:00:00Z');
      tenantModel.findById.mockReturnValue({
        exec: () =>
          Promise.resolve(
            makeTenant({
              status: SubscriptionStatus.GRACE_PERIOD,
              retryAttempts: 7,
              startDate: new Date('2026-01-01T15:00:00Z'),
              currentPeriodStart: new Date('2026-02-01T15:00:00Z'),
              currentPeriodEnd: oldEnd,
            }),
          ),
      });

      await service.subscribe(new Types.ObjectId().toString(), {
        plan: SubscriptionPlan.PREMIUM_MONTHLY,
        paymentMethodToken: 'pm_card_visa',
      });

      const sub = savedSubscription();
      expect(sub.currentPeriodStart).toEqual(oldEnd);
      // Termina el 1 de abril, NO el 8 de abril (sin 7 días gratis)
      expect(sub.currentPeriodEnd.toISOString()).toBe('2026-04-01T15:00:00.000Z');
      expect(sub.retryAttempts).toBe(0);
    });

    it('un tenant free empieza su período en el momento del pago', async () => {
      const now = new Date('2026-03-08T14:00:00Z');
      jest.useFakeTimers().setSystemTime(now);
      tenantModel.findById.mockReturnValue({
        exec: () =>
          Promise.resolve(
            makeTenant({
              plan: SubscriptionPlan.FREE,
              amount: 0,
              paymentMethod: undefined,
              currentPeriodEnd: new Date('2027-01-01T00:00:00Z'),
            }),
          ),
      });

      await service.subscribe(new Types.ObjectId().toString(), {
        plan: SubscriptionPlan.PREMIUM_MONTHLY,
        paymentMethodToken: 'pm_card_visa',
      });

      const sub = savedSubscription();
      expect(sub.currentPeriodStart).toEqual(now);
      expect(sub.currentPeriodEnd.toISOString()).toBe('2026-04-08T14:00:00.000Z');
    });
  });

  // ------------------------------------------------------------
  describe('processRenewalAttempts()', () => {
    it('no cobra de nuevo si ya se intentó hoy (hora local del tenant)', async () => {
      // 7pm en Guatemala; el último intento fue a las 10am del mismo día
      jest.useFakeTimers().setSystemTime(new Date('2026-03-03T01:00:00Z'));
      findResults.push([
        makeTenant({
          status: SubscriptionStatus.GRACE_PERIOD,
          retryAttempts: 1,
          lastRetryDate: new Date('2026-03-02T16:00:00Z'),
          currentPeriodEnd: new Date('2026-03-01T15:00:00Z'),
        }),
      ]);

      await service.processRenewalAttempts();

      expect(stripeProvider.charge).not.toHaveBeenCalled();
    });

    it('no cobra fuera del horario 8am-8pm local', async () => {
      // 6am en Guatemala
      jest.useFakeTimers().setSystemTime(new Date('2026-03-02T12:00:00Z'));
      findResults.push([
        makeTenant({ currentPeriodEnd: new Date('2026-03-01T15:00:00Z') }),
      ]);

      await service.processRenewalAttempts();

      expect(stripeProvider.charge).not.toHaveBeenCalled();
    });

    it('no cobra en un día que no está en el calendario', async () => {
      // Día 3 de gracia: después del intento 2 (día 2), el siguiente es el día 4
      jest.useFakeTimers().setSystemTime(new Date('2026-03-03T15:00:00Z')); // 9am GT
      findResults.push([
        makeTenant({
          status: SubscriptionStatus.GRACE_PERIOD,
          retryAttempts: 2,
          lastRetryDate: new Date('2026-03-02T16:00:00Z'),
          currentPeriodEnd: new Date('2026-03-01T15:00:00Z'),
        }),
      ]);

      await service.processRenewalAttempts();

      expect(stripeProvider.charge).not.toHaveBeenCalled();
    });

    it('en el día programado y en horario, cobra y renueva desde el vencimiento', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-03-04T15:00:00Z')); // día 4, 9am GT
      const oldEnd = new Date('2026-03-01T15:00:00Z');
      findResults.push([
        makeTenant({
          status: SubscriptionStatus.GRACE_PERIOD,
          retryAttempts: 2,
          lastRetryDate: new Date('2026-03-02T16:00:00Z'),
          startDate: new Date('2026-01-01T15:00:00Z'),
          currentPeriodStart: new Date('2026-02-01T15:00:00Z'),
          currentPeriodEnd: oldEnd,
        }),
      ]);

      await service.processRenewalAttempts();

      expect(stripeProvider.charge).toHaveBeenCalledTimes(1);
      const $set = tenantModel.findByIdAndUpdate.mock.calls[0][1].$set;
      expect($set['subscription.currentPeriodStart']).toEqual(oldEnd);
      expect($set['subscription.currentPeriodEnd'].toISOString()).toBe(
        '2026-04-01T15:00:00.000Z',
      );
    });

    it('la consulta excluye a quienes ya agotaron los días de gracia', async () => {
      const now = new Date('2026-03-17T15:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      await service.processRenewalAttempts();

      const filter = tenantModel.find.mock.calls[0][0];
      expect(filter['subscription.currentPeriodEnd'].$gt).toEqual(
        new Date(now.getTime() - GRACE_DAYS * DAY),
      );
    });
  });

  // ------------------------------------------------------------
  describe('downgradeExpiredSubscriptions()', () => {
    it('el downgrade se decide por días de gracia, no por número de rechazos', async () => {
      const now = new Date('2026-03-17T15:00:00Z');
      jest.useFakeTimers().setSystemTime(now);

      // Un tenant que solo tuvo 3 rechazos, pero ya pasaron sus 15 días
      const expired = makeTenant({
        status: SubscriptionStatus.GRACE_PERIOD,
        retryAttempts: 3,
        currentPeriodEnd: new Date('2026-03-01T15:00:00Z'),
      });
      findResults.push([expired], []);

      await service.downgradeExpiredSubscriptions();

      // La consulta usa la fecha de vencimiento, no retryAttempts
      const filter = tenantModel.find.mock.calls[0][0];
      expect(filter['subscription.retryAttempts']).toBeUndefined();
      expect(filter['subscription.currentPeriodEnd'].$lte).toEqual(
        new Date(now.getTime() - GRACE_DAYS * DAY),
      );

      const $set = tenantModel.findByIdAndUpdate.mock.calls[0][1].$set;
      expect($set['subscription.plan']).toBe(SubscriptionPlan.FREE);
    });
  });

  // ------------------------------------------------------------
  describe('renewSubscription() protegida (la usan los webhooks)', () => {
    const periodEnd = new Date('2026-03-01T15:00:00Z');
    const tenant = () =>
      makeTenant({
        status: SubscriptionStatus.GRACE_PERIOD,
        startDate: new Date('2026-01-01T15:00:00Z'),
        currentPeriodStart: new Date('2026-02-01T15:00:00Z'),
        currentPeriodEnd: periodEnd,
      });

    it('solo renueva si el período sigue terminando en la fecha leída', async () => {
      tenantModel.findOneAndUpdate = jest.fn().mockResolvedValue({});

      const renewed = await service.renewSubscription(tenant() as never, 'pi_1', {
        onlyIfPeriodEnd: periodEnd,
      });

      expect(renewed).toBe(true);
      const [filter, update] = tenantModel.findOneAndUpdate.mock.calls[0];
      expect(filter['subscription.currentPeriodEnd']).toEqual(periodEnd);
      // El nuevo período empieza en el vencimiento anterior (regla de siempre)
      expect(update.$set['subscription.currentPeriodStart']).toEqual(periodEnd);
      expect(tenantModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('si otro proceso ya renovó (no encuentra el período), no renueva otra vez', async () => {
      tenantModel.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      const renewed = await service.renewSubscription(tenant() as never, 'pi_1', {
        onlyIfPeriodEnd: periodEnd,
      });

      expect(renewed).toBe(false);
    });
  });
});
