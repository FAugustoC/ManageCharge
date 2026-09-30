/**
 * Errores de webhooks
 *
 * @description Los lanzan los adaptadores (Stripe, CyberSource...) o las
 * reglas de negocio que procesan los eventos. WebhooksService los
 * reconoce con instanceof y los convierte en la respuesta HTTP correcta
 * para el proveedor.
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

/**
 * Todavía no se puede procesar el evento; hay que esperar
 * → HTTP 409 (el proveedor lo reenviará más tarde)
 *
 * @example Llega la confirmación de un cobro que nuestro propio flujo
 * aún está guardando. Se espera unos minutos antes de concluir que es
 * un cobro "huérfano".
 */
export class WebhookRetryLaterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookRetryLaterError';
  }
}
