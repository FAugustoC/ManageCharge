/**
 * Métodos de pago aceptados
 */
export enum PaymentMethod {
  /** Pago en efectivo */
  CASH = 'cash',
  
  /** Transferencia bancaria */
  TRANSFER = 'transfer',
  
  /** Pago con tarjeta */
  CARD = 'card',
  
  /** Otros métodos */
  OTHER = 'other',
}