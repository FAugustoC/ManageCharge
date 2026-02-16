import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  IPaymentProvider,
  CreateCustomerDto,
  CreatePaymentMethodDto,
  ChargeDto,
  ChargeResult,
  PaymentMethodInfo,
} from '../../interfaces/payment-provider.interface.js';

/**
 * Implementación del proveedor de pagos Stripe
 *
 * @description Wrapper para la API de Stripe que implementa
 * la interfaz IPaymentProvider. Maneja:
 * - Creación de customers
 * - Guardado de métodos de pago
 * - Procesamiento de cobros
 * - Manejo de errores
 *
 * @see https://stripe.com/docs/api
 */
@Injectable()
export class StripeProvider implements IPaymentProvider {
  private readonly logger = new Logger(StripeProvider.name);
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');

    if (!secretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY no está configurado en variables de entorno',
      );
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
    });

    this.logger.log('Stripe provider inicializado correctamente');
  }

  /**
   * Crear customer en Stripe
   *
   * @param data - Información del customer
   * @returns ID del customer en Stripe (cus_...)
   */
  async createCustomer(data: CreateCustomerDto): Promise<string> {
    try {
      this.logger.log(`Creando customer en Stripe: ${data.email}`);

      const customer = await this.stripe.customers.create({
        email: data.email,
        name: data.name,
        phone: data.phone || undefined,
        address: data.address ? {
          line1: data.address.line1,
          line2: data.address.line2,
          city: data.address.city,
          state: data.address.state,
          postal_code: data.address.postalCode,
          country: data.address.country,
        } : undefined,
        metadata: {
          ...data.metadata,
          source: 'ManageCharge',
        },
      });

      this.logger.log(`Customer creado exitosamente: ${customer.id}`);
      return customer.id;
    } catch (error) {
      this.logger.error('Error al crear customer en Stripe', error);
      throw new Error(`Error al crear customer: ${error.message}`);
    }
  }

  /**
 * Guardar método de pago en Stripe usando SetupIntent
 *
 * @description Valida la tarjeta y crea registro visible en Stripe Dashboard
 * incluso si falla. Esto permite mejor auditoría y reconciliación.
 *
 * @param data - Customer ID y token del método de pago
 * @returns Información del método guardado
 */
  async savePaymentMethod(
    data: CreatePaymentMethodDto,
  ): Promise<PaymentMethodInfo> {
    try {
      this.logger.log(
        `Validando método de pago para customer: ${data.customerId}`,
      );

      // Usar SetupIntent para validar el método de pago
      // Esto crea un registro en Stripe Dashboard incluso si falla
      const setupIntent = await this.stripe.setupIntents.create({
        customer: data.customerId,
        payment_method: data.paymentMethodToken,
        confirm: true, // Confirmar inmediatamente
        usage: 'off_session', // Para cobros futuros automáticos
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never', // Evitar 3D Secure por ahora
        },
      });

      // Verificar que el SetupIntent fue exitoso
      if (setupIntent.status !== 'succeeded') {
        throw new Error(
          `Validación del método de pago falló: ${setupIntent.status}`,
        );
      }

      // Obtener detalles completos del PaymentMethod
      const paymentMethod = await this.stripe.paymentMethods.retrieve(
        data.paymentMethodToken,
      );

      // MANTENER: Configurar como método de pago predeterminado
      await this.stripe.customers.update(data.customerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });

      this.logger.log(
        `Método de pago validado y guardado: ${paymentMethod.id}`,
      );

      // MANTENER: Retornar información del método
      const card = paymentMethod.card;

      return {
        provider: 'stripe',
        customerId: data.customerId,
        paymentMethodId: paymentMethod.id,
        last4: card?.last4 || '0000',
        brand: card?.brand || 'unknown',
        expiryMonth: card?.exp_month || 0,
        expiryYear: card?.exp_year || 0,
      };
    } catch (error) {
      this.logger.error('Error al guardar método de pago');
      this.logger.error(error);

      // MEJORAR: Manejo de errores más específico
      if (error.type === 'StripeCardError') {
        // Errores de la tarjeta (rechazos, fondos insuficientes, etc.)
        throw new Error(error.message);
      } else if (error.type === 'StripeInvalidRequestError') {
        // Errores de parámetros inválidos
        throw new Error(`Parámetros inválidos: ${error.message}`);
      }

      // Error genérico
      throw new Error(`Error al guardar método de pago: ${error.message}`);
    }
  }

  /**
   * Realizar cobro en Stripe
   *
   * @param data - Datos del cobro
   * @returns Resultado del cobro
   */
  async charge(data: ChargeDto): Promise<ChargeResult> {
    try {
      this.logger.log(
        `Procesando cobro: ${data.amount} ${data.currency} para customer ${data.customerId}`,
      );

      // Crear PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convertir a centavos
        currency: data.currency.toLowerCase(),
        customer: data.customerId,
        payment_method: data.paymentMethodId,
        off_session: true, // Cobro sin interacción del usuario
        confirm: true, // Confirmar inmediatamente
        description: data.description,
        metadata: data.metadata || {},
      });

      if (paymentIntent.status === 'succeeded') {
        this.logger.log(`Cobro exitoso: ${paymentIntent.id}`);
        return {
          success: true,
          transactionId: paymentIntent.id,
        };
      } else {
        this.logger.warn(
          `Cobro con status inesperado: ${paymentIntent.status}`,
        );
        return {
          success: false,
          errorCode: 'unexpected_status',
          errorMessage: `Payment status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      this.logger.error('Error al procesar cobro', error);

      // ✅ FIX 2: Usar Stripe.errors.StripeError en lugar de Stripe.StripeError
      if (error instanceof Stripe.errors.StripeError) {
        return {
          success: false,
          errorCode: error.code || 'stripe_error',
          errorMessage: error.message,
        };
      }

      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: error.message || 'Error desconocido',
      };
    }
  }

  /**
   * Desvincular método de pago del customer
   *
   * @param customerId - ID del customer
   * @param paymentMethodId - ID del método de pago
   */
  async detachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Desvinculando método de pago ${paymentMethodId} del customer ${customerId}`,
      );

      await this.stripe.paymentMethods.detach(paymentMethodId);

      this.logger.log('Método de pago desvinculado exitosamente');
    } catch (error) {
      this.logger.error('Error al desvincular método de pago', error);
      throw new Error(
        `Error al desvincular método de pago: ${error.message}`,
      );
    }
  }

  /**
   * Reembolsar pago
   *
   * @param transactionId - ID del PaymentIntent
   * @param amount - Monto a reembolsar (opcional, null = total)
   */
  async refund(transactionId: string, amount?: number): Promise<void> {
    try {
      this.logger.log(
        `Procesando reembolso para transacción: ${transactionId}`,
      );

      const refundData: Stripe.RefundCreateParams = {
        payment_intent: transactionId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundData);

      this.logger.log(`Reembolso procesado exitosamente: ${refund.id}`);
    } catch (error) {
      this.logger.error('Error al procesar reembolso', error);
      throw new Error(`Error al procesar reembolso: ${error.message}`);
    }
  }

  /**
   * Obtener información de un customer
   *
   * @param customerId - ID del customer
   * @returns Información del customer
   */
  // ✅ FIX 3: Manejar que retrieve puede retornar Customer O DeletedCustomer
  async getCustomer(
    customerId: string,
  ): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      this.logger.error('Error al obtener customer', error);
      throw new Error(`Error al obtener customer: ${error.message}`);
    }
  }

  /**
   * Listar métodos de pago de un customer
   *
   * @param customerId - ID del customer
   * @returns Lista de métodos de pago
   */
  async listPaymentMethods(
    customerId: string,
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      this.logger.error('Error al listar métodos de pago', error);
      throw new Error(`Error al listar métodos de pago: ${error.message}`);
    }
  }
}