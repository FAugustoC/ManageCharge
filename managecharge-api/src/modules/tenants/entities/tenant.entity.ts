import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Interfaz para la dirección del Tenant
 * 
 * @description Subdocumento embebido que almacena
 * la dirección física del tenant (opcional)
 */
export interface TenantAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Interfaz para información bancaria del Tenant
 * 
 * @description Datos para que los clientes del tenant
 * puedan realizar transferencias bancarias
 */
export interface TenantBankInfo {
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  accountHolder?: string;
  routingNumber?: string;
  notes?: string;
}

/**
 * Interfaz para configuraciones del Tenant
 * 
 * @description Preferencias personalizables por cada tenant
 */
export interface TenantSettings {
  currency?: string;
  timezone?: string;
  language?: string;
  notificationDays?: number[];
}

/**
 * Tenant Entity (Schema de MongoDB)
 * 
 * @description Representa una empresa o freelancer suscrito a ManageCharge.
 * Cada tenant tiene su propio espacio aislado con sus clientes, servicios, etc.
 * 
 * Relaciones:
 * - Un Tenant tiene muchos Users
 * - Un Tenant tiene muchos Clients
 * - Un Tenant tiene muchos Services
 * - Un Tenant tiene muchos Payments
 */
@Schema({
  timestamps: true, // Agrega createdAt y updatedAt automáticamente
  collection: 'tenants', // Nombre de la colección en MongoDB
})
export class Tenant {
  /**
   * Nombre del tenant (empresa o persona)
   * @example "Agencia Digital MX"
   */
  @Prop({ required: true, trim: true })
  name: string;

  /**
   * Slug único para URLs amigables
   * @example "agencia-digital-gt"
   */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  /**
   * Email principal de contacto del tenant
   * @example "contacto@agenciadigital.mx"
   */
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /**
   * Teléfono de contacto (opcional)
   * @example "+52 555 123 4567"
   */
  @Prop({ trim: true })
  phone?: string;

  /**
   * Nombre de la empresa (si es diferente al nombre del tenant)
   * @example "Agencia Digital MX S.A. de C.V."
   */
  @Prop({ trim: true })
  companyName?: string;

  /**
   * Sitio web del tenant (opcional)
   * @example "https://agenciadigital.mx"
   */
  @Prop({ trim: true })
  website?: string;

  /**
   * Dirección física del tenant (subdocumento embebido)
   */
  @Prop({ type: Object })
  address?: TenantAddress;

  /**
   * URL del logo del tenant (opcional)
   * @example "https://storage.managecharge.com/logos/abc123.png"
   */
  @Prop({ trim: true })
  logo?: string;

  /**
   * Información bancaria para recibir pagos (subdocumento embebido)
   */
  @Prop({ type: Object })
  bankInfo?: TenantBankInfo;

  /**
   * Configuraciones personalizadas del tenant
   */
  @Prop({ 
    type: Object, 
    default: {
      currency: 'Q.',
      timezone: 'America/Guatemala',
      language: 'es',
      notificationDays: [30, 15, 7, 1],
    }
  })
  settings: TenantSettings;

  /**
   * ¿El tenant está activo?
   * @description false = cuenta suspendida o eliminada
   */
  @Prop({ default: true })
  isActive: boolean;

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
 * Tipo del documento Tenant en MongoDB
 * 
 * @description Combina la clase Tenant con las propiedades
 * del Document de Mongoose (como _id, save(), etc.)
 */
export type TenantDocument = Tenant & Document;

/**
 * Schema de Mongoose generado a partir de la clase
 * 
 * @description Este schema se usa para registrar el modelo
 * en el módulo de NestJS
 */
export const TenantSchema = SchemaFactory.createForClass(Tenant);

/**
 * Índices para optimizar búsquedas
 * 
 * @description Los índices aceleran las queries más comunes
 */
TenantSchema.index({ email: 1 }); // Búsqueda por email
TenantSchema.index({ isActive: 1 }); // Filtrar por activos
TenantSchema.index({ createdAt: -1 }); // Ordenar por fecha (más recientes primero)