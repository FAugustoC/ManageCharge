/**
 * Utilidades de fechas para la facturación de suscripciones
 *
 * @description Funciones PURAS: reciben todo lo que necesitan como
 * parámetros (incluyendo "now") y no leen la base de datos ni el reloj.
 * Eso permite probarlas con fechas exactas, por ejemplo "¿qué pasa el
 * 31 de enero?" o "¿qué pasa a las 7:59pm en Guatemala?", sin esperar
 * a que llegue ese momento.
 *
 * Reglas de negocio que implementan:
 *
 * 1. PERÍODOS CONTINUOS: cada período nuevo empieza exactamente cuando
 *    termina el anterior, nunca en la fecha del pago. Si un tenant paga
 *    el día 6 de su período de gracia, no gana 6 días gratis.
 *
 * 2. UN INTENTO POR DÍA: durante el período de gracia se intenta cobrar
 *    como máximo una vez por día calendario, según la zona horaria del
 *    tenant, y solo entre las 8am y las 8pm de su hora local.
 *
 * 3. DOWNGRADE POR DÍAS: el downgrade ocurre cuando transcurren los días
 *    de gracia completos desde el vencimiento, no al contar rechazos.
 */
import { SubscriptionPlan } from '../../../common/enums/index.js';

/** Horario permitido para cobros automáticos (hora local del tenant) */
export const CHARGING_HOURS = {
  START: 8, // 8:00am (inclusive)
  END: 20, // 8:00pm (exclusive): el último cobro posible es 7:59pm
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================
// ZONAS HORARIAS
// ============================================================

/**
 * Verificar si una zona horaria IANA es válida
 *
 * @example
 * isValidTimeZone('America/Guatemala')  // true
 * isValidTimeZone('America/California') // false (no existe)
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Hora local (0-23) de una fecha en una zona horaria
 *
 * @description Las fechas en JavaScript y MongoDB se guardan en UTC.
 * Intl.DateTimeFormat las "traduce" a la hora que vería una persona
 * en esa zona horaria.
 */
export function getLocalHour(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date);

  return parseInt(hour, 10);
}

/**
 * Día calendario local de una fecha, como texto 'YYYY-MM-DD'
 *
 * @description Sirve para saber si dos momentos caen en el MISMO día
 * para el tenant. Ejemplo: las 11pm del lunes en Guatemala ya son
 * las 5am del martes en UTC, pero para el tenant sigue siendo lunes.
 * Se usa el locale 'en-CA' porque su formato de fecha es YYYY-MM-DD.
 */
export function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * ¿Es horario de cobro (8am-8pm) para el tenant?
 */
export function isWithinChargingHours(now: Date, timeZone: string): boolean {
  const hour = getLocalHour(now, timeZone);
  return hour >= CHARGING_HOURS.START && hour < CHARGING_HOURS.END;
}

// ============================================================
// PERÍODOS DE FACTURACIÓN
// ============================================================

/**
 * Sumar meses respetando el día "ancla" de facturación
 *
 * @description Con Date.setMonth(), el 31 de enero + 1 mes da el 3 de
 * marzo (febrero no tiene día 31 y JavaScript "desborda" al mes
 * siguiente). Aquí, si el mes destino no tiene ese día, se usa el
 * último día del mes: 31 ene -> 28 feb (o 29 en año bisiesto).
 *
 * El "día ancla" es el día del mes en que el tenant se suscribió.
 * Gracias a él, después de febrero se regresa al 31:
 * 31 ene -> 28 feb -> 31 mar -> 30 abr -> 31 may...
 * Sin el ancla, se quedaría en el 28 para siempre.
 *
 * Se usan métodos UTC para que el resultado no dependa de la zona
 * horaria del servidor donde corre el API.
 */
export function addMonthsWithAnchor(
  start: Date,
  months: number,
  anchorDay: number = start.getUTCDate(),
): Date {
  const result = new Date(start);

  // Paso 1: ir al día 1 del mes destino (el día 1 existe en todos los meses)
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  // Paso 2: poner el día ancla, sin pasarse del último día del mes
  const lastDayOfMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(anchorDay, lastDayOfMonth));

  return result;
}

/**
 * Calcular el fin de un período de facturación
 *
 * @param plan - Plan contratado (mensual o anual)
 * @param periodStart - Inicio del período
 * @param anchorDay - Día del mes original de la suscripción
 */
export function calculatePeriodEnd(
  plan: SubscriptionPlan,
  periodStart: Date,
  anchorDay?: number,
): Date {
  const months = plan === SubscriptionPlan.PREMIUM_ANNUAL ? 12 : 1;
  return addMonthsWithAnchor(periodStart, months, anchorDay);
}

/**
 * Momento exacto en que termina el período de gracia
 *
 * @example
 * // Vence el 1 de marzo a las 10:00 con 7 días de gracia
 * getGracePeriodEnd(new Date('2026-03-01T10:00Z'), 7)
 * // -> 8 de marzo a las 10:00
 */
export function getGracePeriodEnd(periodEnd: Date, graceDays: number): Date {
  return new Date(periodEnd.getTime() + graceDays * MS_PER_DAY);
}

/**
 * Fecha límite para el período de gracia, calculada "hacia atrás"
 *
 * @description Un período que venció ANTES de esta fecha ya agotó sus
 * días de gracia. Se usa en las consultas de MongoDB, donde es más
 * fácil comparar currentPeriodEnd contra una fecha fija.
 */
export function getGraceCutoff(now: Date, graceDays: number): Date {
  return new Date(now.getTime() - graceDays * MS_PER_DAY);
}

/**
 * ¿Ya terminó el período de gracia?
 */
export function isGracePeriodExpired(
  now: Date,
  periodEnd: Date,
  graceDays: number,
): boolean {
  return now.getTime() >= getGracePeriodEnd(periodEnd, graceDays).getTime();
}

/**
 * Decidir dónde empieza un período premium nuevo al (re)suscribirse
 *
 * @description Si el tenant todavía tiene premium, o está dentro de su
 * período de gracia, el período nuevo empieza cuando vence el anterior.
 * Esto cierra el hueco de "dejar vencer, esperar 7 días de gracia y
 * suscribirse de nuevo para que el mes empiece hoy".
 *
 * Solo empieza "ahora" si el tenant es nuevo en premium o si su
 * premium anterior ya expiró por completo (vencimiento + gracia).
 */
export function resolveNewPeriodStart(params: {
  now: Date;
  hasPremiumPlan: boolean;
  currentPeriodEnd?: Date | null;
  graceDays: number;
}): Date {
  const { now, hasPremiumPlan, currentPeriodEnd, graceDays } = params;

  if (!hasPremiumPlan || !currentPeriodEnd) {
    return now;
  }

  const periodEnd = new Date(currentPeriodEnd);

  if (isGracePeriodExpired(now, periodEnd, graceDays)) {
    return now;
  }

  return periodEnd;
}

// ============================================================
// REINTENTOS DE COBRO
// ============================================================

/** Motivo por el que se decidió intentar (o no) un cobro */
export type RetryDecisionReason =
  | 'due'
  | 'not_due_yet'
  | 'grace_period_expired'
  | 'max_attempts_reached'
  | 'outside_charging_hours'
  | 'already_attempted_today';

export interface RetryDecision {
  shouldCharge: boolean;
  reason: RetryDecisionReason;
}

/**
 * ¿Toca intentar cobrar la renovación en este momento?
 *
 * @description Aplica todas las reglas en orden. El cron corre varias
 * veces al día (cada 1-2 horas), pero esta función garantiza que cada
 * tenant reciba como máximo UN intento por día local.
 *
 * Con 7 días de gracia y 7 intentos:
 * - Día 1 (vencimiento): intento 1 dentro de 8am-8pm
 * - Días 2 a 7: intentos 2 a 7, uno por día
 * - Al cumplirse los 7 días: downgrade (lo decide otro proceso)
 */
export function evaluateRenewalAttempt(params: {
  now: Date;
  periodEnd: Date;
  lastRetryDate?: Date | null;
  retryAttempts: number;
  maxAttempts: number;
  graceDays: number;
  timeZone: string;
}): RetryDecision {
  const {
    now,
    periodEnd,
    lastRetryDate,
    retryAttempts,
    maxAttempts,
    graceDays,
    timeZone,
  } = params;

  // 1. El período todavía no vence
  if (now.getTime() < periodEnd.getTime()) {
    return { shouldCharge: false, reason: 'not_due_yet' };
  }

  // 2. Se agotaron los días de gracia: ya no se cobra, toca downgrade
  if (isGracePeriodExpired(now, periodEnd, graceDays)) {
    return { shouldCharge: false, reason: 'grace_period_expired' };
  }

  // 3. Ya se hicieron todos los intentos permitidos
  if (retryAttempts >= maxAttempts) {
    return { shouldCharge: false, reason: 'max_attempts_reached' };
  }

  // 4. Fuera del horario 8am-8pm del tenant
  if (!isWithinChargingHours(now, timeZone)) {
    return { shouldCharge: false, reason: 'outside_charging_hours' };
  }

  // 5. Ya se intentó hoy (día calendario local del tenant)
  if (
    lastRetryDate &&
    getLocalDateKey(new Date(lastRetryDate), timeZone) ===
      getLocalDateKey(now, timeZone)
  ) {
    return { shouldCharge: false, reason: 'already_attempted_today' };
  }

  return { shouldCharge: true, reason: 'due' };
}
