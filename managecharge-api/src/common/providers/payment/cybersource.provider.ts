import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  CreateCustomerDto,
  CreatePaymentMethodDto,
  ChargeDto,
  ChargeResult,
  PaymentMethodInfo,
} from '../../interfaces/payment-provider.interface.js';

/**
 * Implementación del proveedor de pagos CyberSource
 * 
 * @description Placeholder para futura implementación.
 * CyberSource se implementará cuando sea necesario.
 * 
 * @see https://developer.cybersource.com/
 */
@Injectable()
export class CyberSourceProvider implements IPaymentProvider {
  private readonly logger = new Logger(CyberSourceProvider.name);

  constructor() {
    this.logger.warn(
      'CyberSource provider no está implementado. Use Stripe por ahora.',
    );
  }

  async createCustomer(data: CreateCustomerDto): Promise<string> {
    throw new Error('CyberSource provider no implementado');
  }

  async savePaymentMethod(
    data: CreatePaymentMethodDto,
  ): Promise<PaymentMethodInfo> {
    throw new Error('CyberSource provider no implementado');
  }

  async charge(data: ChargeDto): Promise<ChargeResult> {
    throw new Error('CyberSource provider no implementado');
  }

  async detachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    throw new Error('CyberSource provider no implementado');
  }

  async refund(transactionId: string, amount?: number): Promise<void> {
    throw new Error('CyberSource provider no implementado');
  }
}