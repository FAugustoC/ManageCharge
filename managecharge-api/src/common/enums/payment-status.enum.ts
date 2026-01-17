/**
 * Estados posibles de un pago individual
 * 
 * @description Define el estado de cada pago/cuota
 */
export enum PaymentStatus {
  /** Pendiente de pago (aún no vence) */
  PENDING = 'pending',

  /** Pagado completamente */
  PAID = 'paid',

  /** Vencido (pasó la fecha de pago) */
  OVERDUE = 'overdue',

  /** Pago parcial recibido */
  PARTIAL = 'partial',

  /** Pago cancelado */
  CANCELLED = 'cancelled',
}