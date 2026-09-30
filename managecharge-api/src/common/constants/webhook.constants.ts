/**
 * Constantes de webhooks
 */

/**
 * Token de inyección para la lista de adaptadores de webhooks
 *
 * @description Una interfaz de TypeScript (IWebhookAdapter) desaparece
 * al compilar, así que Nest no puede usarla para inyectar. Por eso se
 * usa un "token": un identificador único con el que Nest encuentra la
 * lista de adaptadores registrada en webhooks.module.ts.
 */
export const WEBHOOK_ADAPTERS = Symbol('WEBHOOK_ADAPTERS');

/**
 * Tiempo tras el cual un evento "processing" se considera abandonado
 *
 * @description Si el servidor se cae a mitad de procesar un evento, el
 * registro queda en "processing" para siempre. Pasado este tiempo, el
 * siguiente reenvío del proveedor puede retomarlo.
 */
export const WEBHOOK_STALE_PROCESSING_MS = 5 * 60 * 1000;

/** Días que se conservan los registros de webhooks antes de borrarse solos */
export const WEBHOOK_EVENT_RETENTION_DAYS = 90;

/**
 * Antigüedad mínima para considerar "huérfano" un cobro exitoso
 *
 * @description Cuando ManageCharge cobra, Stripe envía el webhook casi
 * al mismo tiempo en que nuestro código está guardando la transacción.
 * Si el webhook llega primero, parecería un cobro sin registro. Por eso,
 * si el cobro tiene menos de este tiempo, se pide a Stripe que lo
 * reenvíe más tarde; para entonces el flujo normal ya lo habrá guardado.
 */
export const WEBHOOK_ORPHAN_PAYMENT_MIN_AGE_MS = 10 * 60 * 1000;
