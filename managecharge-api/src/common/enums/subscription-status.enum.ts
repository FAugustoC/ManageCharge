/**
 * Estados posibles de una suscripción
 * 
 * @description Controla el ciclo de vida de la suscripción
 * y determina el acceso a funciones premium
 */
export enum SubscriptionStatus {
  /**
   * Suscripción activa y pagada
   * - Tiene acceso completo a funciones premium
   * - Próxima renovación programada
   */
  ACTIVE = 'active',

  /**
   * Periodo de gracia (7 días)
   * - Cobro automático falló
   * - Mantiene acceso premium temporalmente
   * - Sistema reintenta cobro diariamente
   */
  GRACE_PERIOD = 'grace_period',

  /**
   * Suscripción expirada
   * - Agotó intentos de cobro (7 días)
   * - Downgrade automático a FREE
   * - Sin acceso a funciones premium
   */
  EXPIRED = 'expired',

  /**
   * Suscripción cancelada por el usuario
   * - autoRenew = false
   * - Mantiene acceso hasta fin de periodo
   * - No se cobrará próximo ciclo
   */
  CANCELLED = 'cancelled',
}