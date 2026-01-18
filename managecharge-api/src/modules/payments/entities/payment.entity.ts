import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PaymentStatus, PaymentMethod } from '../../../common/index.js';

/**
 * Interfaz para archivos adjuntos del pago (comprobantes)
 */
export interface PaymentAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

/**
 * Payment Entity (Schema de MongoDB)
 * 
 * @description Representa un pago individual de un servicio.
 * Cada servicio puede tener múltiples pagos (cuotas).
 * 
 * Relaciones:
 * - Un Payment pertenece a un Tenant (many-to-one)
 * - Un Payment pertenece a un Service (many-to-one)
 * - Un Payment pertenece a un Client (many-to-one, denormalizado)
 */
@Schema({
  timestamps: true,
  collection: 'payments',
})
export class Payment {
  /**
   * Referencia al Tenant
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: MongooseSchema.Types.ObjectId;

  /**
   * Referencia al Service al que pertenece este pago
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Service',
    required: true,
    index: true,
  })
  serviceId: MongooseSchema.Types.ObjectId;

  /**
   * Referencia al Client (denormalizado para consultas rápidas)
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  })
  clientId: MongooseSchema.Types.ObjectId;

  /**
   * Número de pago/cuota (1, 2, 3...)
   * @example 1
   */
  @Prop({ required: true, min: 1 })
  paymentNumber: number;

  /**
   * Descripción o concepto del pago
   * @example "Cuota 1 de 6 - Desarrollo de Website"
   */
  @Prop({ trim: true })
  description?: string;

  /**
   * Monto de este pago
   * @example 1000.00
   */
  @Prop({ required: true, min: 0 })
  amount: number;

  /**
   * Porcentaje que representa del total del servicio
   * @example 16.67 (para 1 de 6 cuotas iguales)
   */
  @Prop({ required: true, min: 0, max: 100 })
  percentage: number;

  /**
   * Moneda del pago
   * @example "GTQ"
   */
  @Prop({ required: true, uppercase: true })
  currency: string;

  /**
   * Estado del pago
   */
  @Prop({
    required: true,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    index: true,
  })
  status: PaymentStatus;

  /**
   * Fecha de vencimiento del pago
   */
  @Prop({ required: true, index: true })
  dueDate: Date;

  /**
   * Fecha en que se realizó el pago
   */
  @Prop()
  paidDate?: Date;

  /**
   * Monto efectivamente pagado
   * Puede ser diferente al amount en caso de pagos parciales
   */
  @Prop({ default: 0, min: 0 })
  paidAmount: number;

  /**
   * Método de pago utilizado
   */
  @Prop({ enum: PaymentMethod })
  paymentMethod?: PaymentMethod;

  /**
   * Número de referencia o transacción
   * @example "TRF-2026-001234"
   */
  @Prop({ trim: true })
  referenceNumber?: string;

  /**
   * Archivos adjuntos (comprobantes de pago)
   */
  @Prop({ type: [Object], default: [] })
  attachments: PaymentAttachment[];

  /**
   * Notas internas sobre el pago
   */
  @Prop({ trim: true })
  notes?: string;

  /**
   * ¿El pago está activo?
   */
  @Prop({ default: true, index: true })
  isActive: boolean;

  /**
   * Timestamps automáticos
   */
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Tipo del documento Payment en MongoDB
 */
export type PaymentDocument = Payment & Document;

/**
 * Schema de Mongoose
 */
export const PaymentSchema = SchemaFactory.createForClass(Payment);

/**
 * Índice para listar pagos de un servicio
 */
PaymentSchema.index({ tenantId: 1, serviceId: 1, paymentNumber: 1 });

/**
 * Índice para listar pagos de un cliente
 */
PaymentSchema.index({ tenantId: 1, clientId: 1 });

/**
 * Índice para buscar pagos por estado
 */
PaymentSchema.index({ tenantId: 1, status: 1 });

/**
 * Índice para buscar pagos vencidos o próximos a vencer
 */
PaymentSchema.index({ tenantId: 1, dueDate: 1, status: 1 });

/**
 * Índice para ordenar por fecha de vencimiento
 */
PaymentSchema.index({ tenantId: 1, dueDate: 1 });

/**
 * Virtual: ¿Está vencido?
 */
PaymentSchema.virtual('isOverdue').get(function() {
  if (this.status === PaymentStatus.PAID || this.status === PaymentStatus.CANCELLED) {
    return false;
  }
  return new Date() > this.dueDate;
});

/**
 * Virtual: Monto pendiente de este pago
 */
PaymentSchema.virtual('remainingAmount').get(function() {
  return this.amount - this.paidAmount;
});

/**
 * Configurar virtuals en JSON
 */
PaymentSchema.set('toJSON', { virtuals: true });
PaymentSchema.set('toObject', { virtuals: true });