/**
 * Métodos de pago aceptados
 * 
 * @description Define cómo el cliente realizó el pago
 */
export enum PaymentMethod {
  /** Efectivo */
  CASH = 'cash',

  /** Transferencia bancaria */
  BANK_TRANSFER = 'bank_transfer',

  /** Tarjeta de crédito/débito */
  CARD = 'card',

  /** Cheque */
  CHECK = 'check',

  /** PayPal u otro servicio similar */
  PAYPAL = 'paypal',

  /** Otro método */
  OTHER = 'other',
}