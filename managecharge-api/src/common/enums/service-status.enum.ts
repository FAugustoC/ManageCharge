/**
 * Estados posibles de un servicio/contrato
 * 
 * @description Define el estado general del servicio,
 * NO el estado de los pagos individuales.
 */
export enum ServiceStatus {
  /** Servicio activo, con pagos pendientes o en curso */
  ACTIVE = 'active',

  /** Todos los pagos completados, servicio finalizado */
  COMPLETED = 'completed',

  /** Servicio cancelado antes de completarse */
  CANCELLED = 'cancelled',

  /** Servicio pausado temporalmente */
  PAUSED = 'paused',
}