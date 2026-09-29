/**
 * Tipos de evento de webhook que le importan a ManageCharge
 *
 * @description Son NUESTROS nombres, no los del proveedor. Por ejemplo,
 * Stripe dice "payment_intent.succeeded" y CyberSource diría otra cosa;
 * cada adaptador traduce el suyo a PAYMENT_SUCCEEDED.
 */
export enum WebhookEventType {
  /**
   * Cobro completado
   * - Confirmación de un cobro, o cobro asíncrono que terminó bien
   */
  PAYMENT_SUCCEEDED = 'payment.succeeded',

  /**
   * Cobro rechazado
   * - Incluye el motivo del rechazo
   */
  PAYMENT_FAILED = 'payment.failed',

  /**
   * Cobro reembolsado
   * - Total o parcial, por ejemplo desde el Dashboard del proveedor
   */
  PAYMENT_REFUNDED = 'payment.refunded',

  /**
   * Disputa abierta (contracargo)
   * - El titular de la tarjeta reclamó el cobro a su banco
   */
  PAYMENT_DISPUTED = 'payment.disputed',

  /**
   * Datos de la tarjeta actualizados
   * - Ej: el banco emitió una tarjeta nueva con otra fecha de expiración
   */
  PAYMENT_METHOD_UPDATED = 'payment_method.updated',

  /**
   * Tarjeta desvinculada del cliente en el proveedor
   */
  PAYMENT_METHOD_DETACHED = 'payment_method.detached',
}
