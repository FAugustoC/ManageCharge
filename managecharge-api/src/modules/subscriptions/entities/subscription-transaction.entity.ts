import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/**
 * Subscription Transaction Entity
 * 
 * @description Registra todas las transacciones relacionadas
 * con suscripciones (cobros, renovaciones, cambios de plan, etc.)
 * 
 * Propósito:
 * - Auditoría completa de pagos
 * - Historial de intentos de cobro
 * - Análisis de revenue
 * - Debugging de issues de pago
 */
@Schema({ timestamps: true, collection: 'subscription_transactions' })
export class SubscriptionTransaction {
  /**
   * Tenant al que pertenece esta transacción
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: MongooseSchema.Types.ObjectId;

  /**
   * Tipo de transacción
   * 
   * @example 'initial', 'renewal', 'manual', 'upgrade', 'downgrade', 'refund'
   */
  @Prop({
    required: true,
    enum: ['initial', 'renewal', 'manual', 'upgrade', 'downgrade', 'refund'],
    index: true,
  })
  type: string;

  /**
   * Plan al que corresponde esta transacción
   * 
   * @example 'free', 'premium_monthly', 'premium_annual'
   */
  @Prop({ required: true })
  plan: string;

  /**
   * Monto cobrado
   * 
   * @description En la unidad de la moneda (no centavos)
   * @example 12.99, 100.00, 2299.00
   */
  @Prop({ required: true })
  amount: number;

  /**
   * Moneda de la transacción
   * 
   * @example 'USD', 'GTQ', 'MXN'
   */
  @Prop({ required: true })
  currency: string;

  /**
   * Estado de la transacción
   * 
   * @example 'pending', 'success', 'failed', 'refunded'
   */
  @Prop({
    required: true,
    enum: ['pending', 'success', 'failed', 'refunded'],
    index: true,
  })
  status: string;

  /**
   * Proveedor de pagos utilizado
   * 
   * @example 'stripe', 'cybersource'
   */
  @Prop({ required: true })
  provider: string;

  /**
   * ID de la transacción en el proveedor
   * 
   * @description Para Stripe: charge_id o payment_intent_id
   * @example 'ch_1ABC123xyz', 'pi_1DEF456xyz'
   */
  @Prop()
  providerTransactionId?: string;

  /**
   * ID del customer en el proveedor
   * 
   * @example 'cus_ABC123xyz'
   */
  @Prop()
  providerCustomerId?: string;

  /**
   * Código de error si la transacción falló
   * 
   * @example 'card_declined', 'insufficient_funds', 'expired_card'
   */
  @Prop()
  errorCode?: string;

  /**
   * Mensaje de error legible
   * 
   * @example 'Your card has insufficient funds.'
   */
  @Prop()
  errorMessage?: string;

  /**
   * ¿Es un reintento de cobro?
   * 
   * @description true si es parte del grace period
   */
  @Prop({ default: false })
  isRetry: boolean;

  /**
   * Número de intento de reintento
   * 
   * @description 1-7 durante grace period
   * @example 1, 2, 3... 7
   */
  @Prop()
  retryAttempt?: number;

  /**
   * Metadata adicional
   * 
   * @description Información contextual de la transacción
   */
  @Prop({ type: Object })
  metadata?: {
    initiatedBy?: 'system' | 'super_admin'; // Quién inició el cobro
    superAdminId?: string; // ID del super admin (si es manual)
    reason?: string; // Razón del cobro manual
    ipAddress?: string; // IP desde donde se inició
    userAgent?: string; // User agent del navegador
  };

  /**
   * Fecha de creación (automática)
   */
  createdAt?: Date;

  /**
   * Fecha de última actualización (automática)
   */
  updatedAt?: Date;
}

/**
 * Tipo del documento en MongoDB
 */
export type SubscriptionTransactionDocument = SubscriptionTransaction & Document;

/**
 * Schema de Mongoose
 */
export const SubscriptionTransactionSchema = SchemaFactory.createForClass(
  SubscriptionTransaction,
);

/**
 * Índices para optimización de queries
 */
// Buscar transacciones de un tenant
SubscriptionTransactionSchema.index({ tenantId: 1, createdAt: -1 });

// Filtrar por status y tipo
SubscriptionTransactionSchema.index({ status: 1, type: 1 });

// Buscar por ID de proveedor
SubscriptionTransactionSchema.index({ providerTransactionId: 1 });

// Analizar reintentos
SubscriptionTransactionSchema.index({ isRetry: 1, retryAttempt: 1 });

// Revenue reporting
SubscriptionTransactionSchema.index({
  status: 1,
  createdAt: -1,
  currency: 1,
});