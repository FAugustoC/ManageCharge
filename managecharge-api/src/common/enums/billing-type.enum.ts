/**
 * Tipos de facturación/cobro para servicios
 */
export enum BillingType {
  /** Pago único - Se cobra una sola vez */
  ONE_TIME = 'one_time',
  
  /** Pago en cuotas - Monto total dividido en abonos */
  INSTALLMENTS = 'installments',
  
  /** Pago mensual recurrente */
  MONTHLY = 'monthly',
  
  /** Pago anual recurrente */
  ANNUAL = 'annual',
  
  /** Configuración personalizada */
  CUSTOM = 'custom',
}