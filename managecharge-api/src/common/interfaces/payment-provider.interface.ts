/**
 * Interfaz abstracta para proveedores de pago
 * 
 * @description Define el contrato que deben cumplir todos
 * los proveedores de pago (Stripe, CyberSource, etc.)
 * 
 * Patrón de diseño: Strategy Pattern
 * Permite cambiar de proveedor sin modificar el servicio principal
 */

/**
 * DTO para crear un cliente en el proveedor
 */
export interface CreateCustomerDto {
  email: string;
  name: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * DTO para guardar método de pago
 */
export interface CreatePaymentMethodDto {
  customerId: string;
  paymentMethodToken: string; // Token generado por frontend (Stripe.js)
}

/**
 * DTO para realizar un cobro
 */
export interface ChargeDto {
  customerId: string;
  paymentMethodId: string;
  /**
   * Monto en UNIDADES COMPLETAS de la moneda (ej: 12.99 = $12.99 USD,
   * 12000 = 12,000 CLP). NO enviar centavos: cada provider se encarga
   * de convertir a la unidad mínima con toMinorUnits().
   */
  amount: number;
  currency: string; // Código ISO 4217: 'USD', 'GTQ', 'MXN', etc.
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Resultado de un cobro
 */
export interface ChargeResult {
  success: boolean;
  transactionId?: string; // ID del cobro en el proveedor
  errorCode?: string; // Código de error si falló
  errorMessage?: string; // Mensaje de error legible
}

/**
 * Información del método de pago guardado
 *
 * @description Fuente única de verdad para este tipo. La usan los
 * providers (lo que devuelven) y la entidad Tenant (lo que se guarda
 * en MongoDB). NO almacena datos reales de la tarjeta, solo
 * referencias al proveedor de pagos.
 */
export interface PaymentMethodInfo {
  provider: string; // Valor del enum PaymentProvider: 'stripe', etc.
  customerId: string; // ID del customer en el proveedor (cus_...)
  paymentMethodId: string; // ID del método de pago tokenizado (pm_...)
  last4: string; // Últimos 4 dígitos
  brand: string; // 'visa', 'mastercard', 'amex'
  expiryMonth: number;
  expiryYear: number;
}

/**
 * Interfaz principal del proveedor de pagos
 */
export interface IPaymentProvider {
  /**
   * Crear cliente en el proveedor
   * 
   * @param data - Información del cliente
   * @returns ID del cliente en el proveedor
   */
  createCustomer(data: CreateCustomerDto): Promise<string>;

  /**
   * Guardar método de pago (tarjeta tokenizada)
   * 
   * @param data - Token del método de pago
   * @returns Información del método guardado
   */
  savePaymentMethod(data: CreatePaymentMethodDto): Promise<PaymentMethodInfo>;

  /**
   * Realizar cobro
   * 
   * @param data - Datos del cobro
   * @returns Resultado del cobro
   */
  charge(data: ChargeDto): Promise<ChargeResult>;

  /**
   * Cancelar método de pago en el proveedor
   * 
   * @param customerId - ID del cliente
   * @param paymentMethodId - ID del método de pago
   */
  detachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void>;

  /**
   * Reembolsar un pago
   * 
   * @param transactionId - ID de la transacción
   * @param amount - Monto en unidades completas (opcional, sin valor = total)
   * @param currency - Moneda del pago original (requerida si se envía amount)
   */
  refund(
    transactionId: string,
    amount?: number,
    currency?: string,
  ): Promise<void>;
}