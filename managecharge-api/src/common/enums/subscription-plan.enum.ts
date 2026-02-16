/**
 * Planes de suscripción disponibles en ManageCharge
 * 
 * @description Define los tres niveles de membresía:
 * - FREE: Plan gratuito con funciones básicas
 * - PREMIUM_MONTHLY: Plan premium con pago mensual
 * - PREMIUM_ANNUAL: Plan premium con pago anual (23% descuento)
 */
export enum SubscriptionPlan {
  /**
   * Plan gratuito
   * - Gestión de clientes, servicios y pagos
   * - Solo notificaciones push (no email/WhatsApp automáticos)
   */
  FREE = 'free',

  /**
   * Plan premium mensual
   * - Todas las funciones + notificaciones automáticas
   * - Cobro mensual recurrente
   */
  PREMIUM_MONTHLY = 'premium_monthly',

  /**
   * Plan premium anual
   * - Todas las funciones + notificaciones automáticas
   * - Cobro anual con 23% de descuento
   */
  PREMIUM_ANNUAL = 'premium_annual',
}