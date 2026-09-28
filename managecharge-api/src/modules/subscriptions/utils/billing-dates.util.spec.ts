import { SubscriptionPlan } from '../../../common/enums/index';
import {
  addMonthsWithAnchor,
  calculatePeriodEnd,
  evaluateRenewalAttempt,
  getGracePeriodEnd,
  getLocalDateKey,
  isGracePeriodExpired,
  isValidTimeZone,
  isWithinChargingHours,
  resolveNewPeriodStart,
} from './billing-dates.util';

/**
 * Pruebas de las reglas de facturación
 *
 * Guatemala está en UTC-6 todo el año (no usa horario de verano),
 * así que 8:00am en Guatemala = 14:00 UTC y 8:00pm = 02:00 UTC del
 * día siguiente. Todas las fechas de prueba se escriben en UTC (la
 * "Z" al final) para que el resultado no dependa de la computadora
 * donde corran las pruebas.
 *
 * Ejecutar: npm test -- billing-dates
 */
const GT = 'America/Guatemala';
const utc = (iso: string) => new Date(iso);

describe('Utilidades de fechas de facturación', () => {
  // ------------------------------------------------------------
  describe('Zonas horarias', () => {
    it('detecta zonas válidas e inválidas', () => {
      expect(isValidTimeZone(GT)).toBe(true);
      expect(isValidTimeZone('America/California')).toBe(false);
    });

    it('usa el día local del tenant, no el día UTC', () => {
      // 03:00 UTC del martes = 9:00pm del lunes en Guatemala
      const moment = utc('2026-03-03T03:00:00Z');
      expect(getLocalDateKey(moment, 'UTC')).toBe('2026-03-03');
      expect(getLocalDateKey(moment, GT)).toBe('2026-03-02');
    });

    it('respeta el horario 8am-8pm local', () => {
      expect(isWithinChargingHours(utc('2026-03-02T13:59:00Z'), GT)).toBe(false); // 7:59am
      expect(isWithinChargingHours(utc('2026-03-02T14:00:00Z'), GT)).toBe(true); // 8:00am
      expect(isWithinChargingHours(utc('2026-03-03T01:59:00Z'), GT)).toBe(true); // 7:59pm
      expect(isWithinChargingHours(utc('2026-03-03T02:00:00Z'), GT)).toBe(false); // 8:00pm
    });
  });

  // ------------------------------------------------------------
  describe('Cálculo de períodos (fin de mes)', () => {
    it('31 de enero + 1 mes = 28 de febrero (no 3 de marzo)', () => {
      const end = addMonthsWithAnchor(utc('2026-01-31T15:00:00Z'), 1);
      expect(end.toISOString()).toBe('2026-02-28T15:00:00.000Z');
    });

    it('en año bisiesto usa el 29 de febrero', () => {
      const end = addMonthsWithAnchor(utc('2028-01-31T15:00:00Z'), 1);
      expect(end.toISOString()).toBe('2028-02-29T15:00:00.000Z');
    });

    it('con el día ancla regresa al 31 después de febrero', () => {
      const feb = utc('2026-02-28T15:00:00Z');
      const mar = calculatePeriodEnd(SubscriptionPlan.PREMIUM_MONTHLY, feb, 31);
      expect(mar.toISOString()).toBe('2026-03-31T15:00:00.000Z');

      const apr = calculatePeriodEnd(SubscriptionPlan.PREMIUM_MONTHLY, mar, 31);
      expect(apr.toISOString()).toBe('2026-04-30T15:00:00.000Z');
    });

    it('plan anual: 29 feb 2028 + 1 año = 28 feb 2029', () => {
      const end = calculatePeriodEnd(
        SubscriptionPlan.PREMIUM_ANNUAL,
        utc('2028-02-29T15:00:00Z'),
      );
      expect(end.toISOString()).toBe('2029-02-28T15:00:00.000Z');
    });

    it('un mes normal conserva día y hora', () => {
      const end = calculatePeriodEnd(
        SubscriptionPlan.PREMIUM_MONTHLY,
        utc('2026-03-15T15:30:00Z'),
      );
      expect(end.toISOString()).toBe('2026-04-15T15:30:00.000Z');
    });
  });

  // ------------------------------------------------------------
  describe('Período de gracia', () => {
    const periodEnd = utc('2026-03-01T15:00:00Z');

    it('termina exactamente 7 días después del vencimiento', () => {
      expect(getGracePeriodEnd(periodEnd, 7).toISOString()).toBe(
        '2026-03-08T15:00:00.000Z',
      );
    });

    it('un minuto antes sigue vigente; al cumplirse, expira', () => {
      expect(isGracePeriodExpired(utc('2026-03-08T14:59:00Z'), periodEnd, 7)).toBe(false);
      expect(isGracePeriodExpired(utc('2026-03-08T15:00:00Z'), periodEnd, 7)).toBe(true);
    });
  });

  // ------------------------------------------------------------
  describe('Inicio de un período nuevo al suscribirse', () => {
    const oldEnd = utc('2026-03-01T15:00:00Z');

    it('en el último día de gracia, el período empieza en el vencimiento anterior', () => {
      const start = resolveNewPeriodStart({
        now: utc('2026-03-08T14:00:00Z'), // día 7 de gracia
        hasPremiumPlan: true,
        currentPeriodEnd: oldEnd,
        graceDays: 7,
      });
      expect(start).toEqual(oldEnd);
    });

    it('con premium todavía vigente (ej: cancelado), respeta los días ya pagados', () => {
      const start = resolveNewPeriodStart({
        now: utc('2026-02-20T14:00:00Z'),
        hasPremiumPlan: true,
        currentPeriodEnd: oldEnd,
        graceDays: 7,
      });
      expect(start).toEqual(oldEnd);
    });

    it('si la gracia ya expiró, el período empieza ahora', () => {
      const now = utc('2026-03-10T14:00:00Z');
      expect(
        resolveNewPeriodStart({
          now,
          hasPremiumPlan: true,
          currentPeriodEnd: oldEnd,
          graceDays: 7,
        }),
      ).toEqual(now);
    });

    it('un tenant free empieza ahora', () => {
      const now = utc('2026-03-05T14:00:00Z');
      expect(
        resolveNewPeriodStart({
          now,
          hasPremiumPlan: false,
          currentPeriodEnd: oldEnd,
          graceDays: 7,
        }),
      ).toEqual(now);
    });
  });

  // ------------------------------------------------------------
  describe('Decisión de reintento (un cobro por día)', () => {
    const base = {
      periodEnd: utc('2026-03-01T15:00:00Z'), // 9:00am Guatemala
      lastRetryDate: null as Date | null,
      retryAttempts: 0,
      maxAttempts: 7,
      graceDays: 7,
      timeZone: GT,
    };

    it('no cobra antes del vencimiento', () => {
      const r = evaluateRenewalAttempt({ ...base, now: utc('2026-03-01T14:00:00Z') });
      expect(r).toEqual({ shouldCharge: false, reason: 'not_due_yet' });
    });

    it('cobra el día del vencimiento dentro del horario', () => {
      const r = evaluateRenewalAttempt({ ...base, now: utc('2026-03-01T16:00:00Z') });
      expect(r).toEqual({ shouldCharge: true, reason: 'due' });
    });

    it('no cobra dos veces el mismo día local', () => {
      const r = evaluateRenewalAttempt({
        ...base,
        retryAttempts: 1,
        lastRetryDate: utc('2026-03-01T16:00:00Z'), // 10am GT
        now: utc('2026-03-02T01:00:00Z'), // 7pm GT, mismo día (aunque en UTC ya es día 2)
      });
      expect(r.reason).toBe('already_attempted_today');
    });

    it('cobra al día siguiente a partir de las 8am local', () => {
      const lastRetryDate = utc('2026-03-01T16:00:00Z');

      const early = evaluateRenewalAttempt({
        ...base,
        retryAttempts: 1,
        lastRetryDate,
        now: utc('2026-03-02T12:00:00Z'), // 6am GT
      });
      expect(early.reason).toBe('outside_charging_hours');

      const onTime = evaluateRenewalAttempt({
        ...base,
        retryAttempts: 1,
        lastRetryDate,
        now: utc('2026-03-02T14:00:00Z'), // 8am GT
      });
      expect(onTime.shouldCharge).toBe(true);
    });

    it('no cobra después de agotar los intentos', () => {
      const r = evaluateRenewalAttempt({
        ...base,
        retryAttempts: 7,
        lastRetryDate: utc('2026-03-07T16:00:00Z'),
        now: utc('2026-03-08T14:30:00Z'),
      });
      expect(r.reason).toBe('max_attempts_reached');
    });

    it('no cobra cuando la gracia ya expiró', () => {
      const r = evaluateRenewalAttempt({
        ...base,
        retryAttempts: 3,
        now: utc('2026-03-08T15:00:00Z'),
      });
      expect(r.reason).toBe('grace_period_expired');
    });

    it('simulación completa: exactamente 7 intentos en 7 días, uno por día', () => {
      // El cron corre cada hora durante 8 días; contamos cuántos cobros ocurren
      let retryAttempts = 0;
      let lastRetryDate: Date | null = null;
      const attemptDays: string[] = [];

      const start = base.periodEnd.getTime();
      for (let hour = 0; hour <= 8 * 24; hour++) {
        const now = new Date(start + hour * 60 * 60 * 1000);
        const decision = evaluateRenewalAttempt({
          ...base,
          now,
          retryAttempts,
          lastRetryDate,
        });

        if (decision.shouldCharge) {
          retryAttempts++; // el cobro es rechazado
          lastRetryDate = now;
          attemptDays.push(getLocalDateKey(now, GT));
        }
      }

      expect(retryAttempts).toBe(7);
      expect(new Set(attemptDays).size).toBe(7); // 7 días distintos
      expect(attemptDays[0]).toBe('2026-03-01');
      expect(attemptDays[6]).toBe('2026-03-07');
    });

    it('si vence de noche, los 7 intentos igual caben dentro de la gracia', () => {
      let retryAttempts = 0;
      let lastRetryDate: Date | null = null;
      const periodEnd = utc('2026-03-02T04:00:00Z'); // 10pm GT del 1 de marzo

      for (let hour = 0; hour <= 8 * 24; hour++) {
        const now = new Date(periodEnd.getTime() + hour * 60 * 60 * 1000);
        const decision = evaluateRenewalAttempt({
          ...base,
          periodEnd,
          now,
          retryAttempts,
          lastRetryDate,
        });
        if (decision.shouldCharge) {
          retryAttempts++;
          lastRetryDate = now;
        }
      }

      expect(retryAttempts).toBe(7);
    });
  });
});
