/**
 * Estados de una transacción de pago
 * 
 * @description Refleja el resultado del cobro
 * en el proveedor de pagos (Stripe/CyberSource)
 */
export enum TransactionStatus {
  /**
   * Transacción pendiente
   * - Aún no procesada
   */
  PENDING = 'pending',

  /**
   * Transacción exitosa
   * - Pago procesado correctamente
   * - Fondos capturados
   */
  SUCCESS = 'success',

  /**
   * Transacción fallida
   * - Pago rechazado
   * - Incluye código de error del proveedor
   */
  FAILED = 'failed',

  /**
   * Transacción reembolsada
   * - Fondos devueltos al cliente
   */
  REFUNDED = 'refunded',
}