/**
 * Barrel export para las utilidades del módulo de Subscriptions
 *
 * @description Funciones puras de fechas de facturación (períodos,
 * días de gracia, calendario de reintentos).
 *
 * Son de uso INTERNO del módulo: por eso no se re-exportan en
 * src/modules/subscriptions/index.ts. Otros módulos no deberían
 * depender de cómo Subscriptions calcula sus fechas.
 */
export * from './billing-dates.util.js';
