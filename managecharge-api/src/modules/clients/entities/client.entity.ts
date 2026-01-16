import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/**
 * Interfaz para la dirección del Client
 * 
 * @description Subdocumento embebido que almacena
 * la dirección del cliente (opcional)
 */
export interface ClientAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Client Entity (Schema de MongoDB)
 * 
 * @description Representa a un cliente de un Tenant.
 * Los clientes son las personas/empresas a quienes
 * el Tenant les cobra por sus servicios.
 * 
 * Relaciones:
 * - Un Client pertenece a un Tenant (many-to-one)
 * - Un Client fue creado por un User (many-to-one)
 * - Un Client tiene muchos Services (one-to-many) [futuro]
 * - Un Client tiene muchos Payments (one-to-many) [futuro]
 */
@Schema({
  timestamps: true,
  collection: 'clients',
})
export class Client {
  /**
   * Referencia al Tenant al que pertenece este cliente
   * 
   * @description Todo cliente debe pertenecer a un tenant.
   * Esto garantiza el aislamiento de datos entre tenants.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenantId: MongooseSchema.Types.ObjectId;

  /**
   * Usuario que creó este cliente
   * 
   * @description Referencia al usuario que registró el cliente.
   * Útil para auditoría y seguimiento.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: MongooseSchema.Types.ObjectId;

  /**
   * Nombre completo del cliente o persona de contacto
   * @example "María García López"
   */
  @Prop({ required: true, trim: true })
  name: string;

  /**
   * Email del cliente
   * 
   * @description Se usa para enviar recordatorios de pago
   * y comunicaciones. Debe ser único dentro del tenant.
   * @example "maria@empresa.com"
   */
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /**
   * Teléfono del cliente (opcional)
   * @example "+502 5555-1234"
   */
  @Prop({ trim: true })
  phone?: string;

  /**
   * Nombre de la empresa del cliente (opcional)
   * 
   * @description Si el cliente es una empresa, aquí va el nombre.
   * Si es una persona individual, puede dejarse vacío.
   * @example "Restaurante El Buen Sabor S.A."
   */
  @Prop({ trim: true })
  company?: string;

  /**
   * Identificación fiscal (NIT, RFC, RUC, etc.)
   * 
   * @description Necesario para emitir facturas fiscales.
   * El formato varía según el país.
   * @example "12345678-9" (Guatemala)
   */
  @Prop({ trim: true })
  taxId?: string;

  /**
   * Dirección del cliente (subdocumento embebido)
   */
  @Prop({ type: Object })
  address?: ClientAddress;

  /**
   * Sitio web del cliente (opcional)
   * @example "https://www.restaurante.com"
   */
  @Prop({ trim: true })
  website?: string;

  /**
   * Notas internas sobre el cliente
   * 
   * @description Información adicional que el usuario
   * quiera recordar sobre este cliente. Solo visible
   * para el tenant, nunca para el cliente.
   * @example "Prefiere que le llamen por la tarde"
   */
  @Prop({ trim: true })
  notes?: string;

  /**
   * ¿El cliente está activo?
   * 
   * @description false = cliente inactivo (ya no se le cobra)
   * Usamos soft delete para mantener el historial.
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
 * Tipo del documento Client en MongoDB
 */
export type ClientDocument = Client & Document;

/**
 * Schema de Mongoose
 */
export const ClientSchema = SchemaFactory.createForClass(Client);

/**
 * Índice compuesto único: email debe ser único dentro de cada tenant
 * 
 * @description Permite que dos tenants diferentes tengan
 * clientes con el mismo email, pero dentro de un tenant
 * cada email debe ser único.
 */
ClientSchema.index({ tenantId: 1, email: 1 }, { unique: true });

/**
 * Índice para búsquedas por nombre dentro de un tenant
 */
ClientSchema.index({ tenantId: 1, name: 1 });

/**
 * Índice para filtrar por estado activo dentro de un tenant
 */
ClientSchema.index({ tenantId: 1, isActive: 1 });

/**
 * Índice para ordenar por fecha de creación
 */
ClientSchema.index({ tenantId: 1, createdAt: -1 });