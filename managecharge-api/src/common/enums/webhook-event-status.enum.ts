/**
 * Estados del procesamiento de un webhook
 *
 * @description Se guarda en la bitácora de webhooks (WebhookEvent) y
 * permite la idempotencia: saber si un evento ya se procesó.
 */
export enum WebhookEventStatus {
  /**
   * En proceso
   * - Una petición lo está atendiendo en este momento
   */
  PROCESSING = 'processing',

  /**
   * Procesado con éxito
   * - Se aplicó la regla de negocio correspondiente
   */
  PROCESSED = 'processed',

  /**
   * Ignorado
   * - Llegó bien, pero no requiere acción
   */
  IGNORED = 'ignored',

  /**
   * Fallido
   * - El proveedor lo reenviará y se volverá a intentar
   */
  FAILED = 'failed',
}
