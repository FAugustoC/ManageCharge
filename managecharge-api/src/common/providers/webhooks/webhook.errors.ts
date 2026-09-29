/**
 * Errores de los adaptadores de webhooks
 *
 * @description Los lanza cualquier adaptador (Stripe, CyberSource...).
 * WebhooksService los reconoce con instanceof y los convierte en la
 * respuesta HTTP correcta para el proveedor.
 */

/**
 * La firma no coincide: el mensaje no viene del proveedor o fue alterado
 * → HTTP 400
 */
export class InvalidWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWebhookSignatureError';
  }
}

/**
 * Falta configuración (ej: STRIPE_WEBHOOK_SECRET vacío)
 * → HTTP 503 (el proveedor reintentará)
 */
export class WebhookNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookNotConfiguredError';
  }
}
