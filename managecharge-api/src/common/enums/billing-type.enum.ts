/**
 * Tipos de facturación/cobro para servicios
 */
export enum BillingType {
  /** Pago único - Se cobra una sola vez */
  ONE_TIME = 'one_time',
  
  /** Pago en cuotas - Monto total dividido en abonos */
  INSTALLMENTS = 'installments',
  
  /** Cobro recurrente mensual (sin fin definido) */
  RECURRING_MONTHLY = 'recurring_monthly',

  /** Cobro recurrente anual (sin fin definido) */
  RECURRING_ANNUAL = 'recurring_annual',
}