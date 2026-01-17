import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { BillingType, ServiceStatus, ServiceType, } from '../../../common/index.js';

/**
 * Interfaz para archivos adjuntos (cotización, contrato, etc.)
 */
export interface ServiceAttachment {
  filename: string;
  originalName: string;
  mimeType: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

/**
 * Interfaz para configuración de cuotas personalizadas
 */
export interface InstallmentConfig {
  number: number;
  percentage: number;
  dueDate?: Date;
}

/**
 * Service Entity (Schema de MongoDB)
 * 
 * @description Representa un servicio o contrato con un cliente.
 * El servicio define el acuerdo general, mientras que los pagos
 * individuales se manejan en la colección de Payments.
 */
@Schema({
  timestamps: true,
  collection: 'services',
})
export class Service {
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
   * Referencia al Client (a quién se le cobra)
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true,
  })
  clientId: MongooseSchema.Types.ObjectId;

  /**
   * Usuario que creó este servicio
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: MongooseSchema.Types.ObjectId;

  /**
   * Nombre del servicio
   * @example "Desarrollo de sitio web corporativo"
   */
  @Prop({ required: true, trim: true })
  name: string;

  /**
   * Descripción detallada del servicio
   * @example "Sitio web de 5 páginas con diseño responsivo, incluye hosting por 1 año"
   */
  @Prop({ trim: true })
  description?: string;

  /**
   * Tipo de servicio
   */
  @Prop({
    enum: ServiceType,
    default: ServiceType.OTHER,
    index: true,
  })
  serviceType: ServiceType;

  /**
   * Monto TOTAL del servicio
   * @example 6000.00
   */
  @Prop({ required: true, min: 0 })
  totalAmount: number;

  /**
   * Moneda del cobro
   * @example "GTQ", "USD", "MXN"
   */
  @Prop({ required: true, default: 'GTQ', uppercase: true })
  currency: string;

  /**
   * Tipo de facturación
   */
  @Prop({
    required: true,
    enum: BillingType,
    default: BillingType.ONE_TIME,
  })
  billingType: BillingType;

  /**
   * Número de cuotas (solo para INSTALLMENTS)
   * @example 6
   */
  @Prop({ min: 1 })
  installmentsCount?: number;

  /**
   * Configuración de cuotas personalizadas
   * Si está vacío, las cuotas son iguales
   */
  @Prop({ type: [Object] })
  installmentsConfig?: InstallmentConfig[];

  /**
   * Estado del servicio
   */
  @Prop({
    required: true,
    enum: ServiceStatus,
    default: ServiceStatus.ACTIVE,
    index: true,
  })
  status: ServiceStatus;

  /**
   * Fecha de inicio del servicio
   */
  @Prop({ required: true, default: Date.now })
  startDate: Date;

  /**
   * Fecha de fin del servicio (opcional)
   */
  @Prop()
  endDate?: Date;

  /**
   * Archivos adjuntos (cotización, contrato, etc.)
   */
  @Prop({ type: [Object], default: [] })
  attachments: ServiceAttachment[];

  /**
   * Notas internas sobre el servicio
   */
  @Prop({ trim: true })
  notes?: string;

  /**
   * Monto total ya pagado (se actualiza cuando se registran pagos)
   */
  @Prop({ default: 0, min: 0 })
  paidAmount: number;

  /**
   * ¿El servicio está activo?
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
 * Tipo del documento Service en MongoDB
 */
export type ServiceDocument = Service & Document;

/**
 * Schema de Mongoose
 */
export const ServiceSchema = SchemaFactory.createForClass(Service);

/**
 * Índice para listar servicios de un cliente
 */
ServiceSchema.index({ tenantId: 1, clientId: 1 });

/**
 * Índice para buscar servicios por estado dentro de un tenant
 */
ServiceSchema.index({ tenantId: 1, status: 1 });

/**
 * Índice para buscar servicios por tipo
 */
ServiceSchema.index({ tenantId: 1, serviceType: 1 });

/**
 * Índice para ordenar por fecha de creación
 */
ServiceSchema.index({ tenantId: 1, createdAt: -1 });

/**
 * Virtual: Monto pendiente por pagar
 */
ServiceSchema.virtual('pendingAmount').get(function() {
  return this.totalAmount - this.paidAmount;
});

/**
 * Virtual: Porcentaje pagado
 */
ServiceSchema.virtual('paidPercentage').get(function() {
  if (this.totalAmount === 0) return 100;
  return Math.round((this.paidAmount / this.totalAmount) * 100);
});

/**
 * Configurar virtuals en JSON
 */
ServiceSchema.set('toJSON', { virtuals: true });
ServiceSchema.set('toObject', { virtuals: true });