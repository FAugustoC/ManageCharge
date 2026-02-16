/**
 * Tipos de transacciones de suscripción
 * 
 * @description Categoriza cada cobro o cambio en la suscripción
 * para auditoría y análisis
 */
export enum TransactionType {
  /**
   * Primera suscripción del tenant
   * - Usuario contrata premium por primera vez
   */
  INITIAL = 'initial',

  /**
   * Renovación automática
   * - Cobro recurrente mensual/anual
   * - Ejecutado por cron job
   */
  RENEWAL = 'renewal',

  /**
   * Cobro manual por super admin
   * - Ejecutado desde panel de administración
   * - Incluye metadata de quién y por qué
   */
  MANUAL = 'manual',

  /**
   * Cambio a plan superior
   * - De FREE a PREMIUM
   * - De MONTHLY a ANNUAL
   */
  UPGRADE = 'upgrade',

  /**
   * Cambio a plan inferior
   * - De PREMIUM a FREE
   * - De ANNUAL a MONTHLY
   */
  DOWNGRADE = 'downgrade',

  /**
   * Reembolso de pago
   * - Devolución total o parcial
   */
  REFUND = 'refund',
}