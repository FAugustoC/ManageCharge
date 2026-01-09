/**
 * Estados posibles de un servicio/cuenta de cobro
 */
export enum ServiceStatus {
  /** Pendiente de pago - Aún no ha vencido */
  PENDING = 'pending',
  
  /** Pagado completamente - Saldo en cero */
  PAID = 'paid',
  
  /** Vencido - Pasó la fecha de pago sin completar */
  OVERDUE = 'overdue',
  
  /** Cancelado - Servicio dado de baja */
  CANCELLED = 'cancelled',
}