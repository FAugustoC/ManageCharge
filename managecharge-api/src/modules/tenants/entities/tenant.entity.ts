import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { PaymentMethodInfo } from '../../../common/interfaces/payment-provider.interface.js';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_CURRENCY,
} from '../../../common/constants/app.constants.js';

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
 * Registro histórico de suscripciones
 * 
 * @description Mantiene historial de cambios de plan
 */
export interface SubscriptionHistory {
  plan: string; // 'free', 'premium_monthly', 'premium_annual'
  startDate: Date;
  endDate: Date;
  status: 'completed' | 'cancelled' | 'failed';
  reason?: string; // Motivo del cambio
}

/**
 * Configuración completa de suscripción
 * 
 * @description Controla el plan, estado, pagos y renovación
 */
export interface SubscriptionConfig {
  // Plan y estado actual
  plan: string; // 'free' | 'premium_monthly' | 'premium_annual'
  status: string; // 'active' | 'grace_period' | 'expired' | 'cancelled'

  // Fechas del periodo actual
  startDate: Date; // Inicio de la suscripción
  currentPeriodStart: Date; // Inicio del periodo actual
  currentPeriodEnd: Date; // Fin del periodo actual

  // Precio y moneda
  amount: number; // Monto del plan en la moneda local
  currency: string; // 'USD', 'GTQ', 'MXN', etc.

  // Renovación automática
  autoRenew: boolean; // ¿Renovar automáticamente?
  retryAttempts: number; // Intentos de cobro realizados (0-7)
  maxRetryAttempts: number; // Máximo de reintentos (default: 7)
  lastRetryDate?: Date; // Último intento de cobro
  nextRetryDate?: Date; // Próximo intento programado

  // Cancelación
  cancelledAt?: Date; // Fecha de cancelación
  cancellationReason?: string; // Motivo de cancelación

  // Método de pago (tipo definido en common/interfaces/payment-provider.interface.ts)
  paymentMethod?: PaymentMethodInfo; // Info del método guardado

  // Histórico
  subscriptionHistory: SubscriptionHistory[]; // Cambios de plan
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
   * @example "Agencia Digital GT"
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
   * @example "contacto@agenciadigital.com"
   */
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /**
   * Teléfono de contacto (opcional)
   * @example "+502 1234 5678"
   */
  @Prop({ trim: true })
  phone?: string;

  /**
   * Nombre de la empresa (si es diferente al nombre del tenant)
   * @example "Agencia Digital GT S.A."
   */
  @Prop({ trim: true })
  companyName?: string;

  /**
   * Sitio web del tenant (opcional)
   * @example "https://agenciadigital.com"
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
   *
   * @description El default es una FUNCIÓN para que cada tenant
   * reciba su propio objeto nuevo (ver nota en `subscription`).
   */
  @Prop({
    type: Object,
    default: (): TenantSettings => ({
      currency: DEFAULT_CURRENCY,
      timezone: DEFAULT_TIMEZONE,
      language: 'en',
      notificationDays: [30, 15, 7, 1],
    }),
  })
  settings: TenantSettings;

  /**
   * Configuración de suscripción del tenant
   * 
   * @description Controla el plan activo, estado de pago,
   * método de pago guardado y renovación automática
   */
  /**
   * IMPORTANTE: el default es una FUNCIÓN, no un objeto literal.
   *
   * Con un objeto literal, `new Date()` se ejecuta UNA sola vez al
   * arrancar el servidor, y todos los tenants creados después
   * heredarían la misma fecha de inicio y de vencimiento.
   * Con una función, Mongoose la ejecuta cada vez que crea un
   * documento, así que cada tenant recibe sus propias fechas.
   */
  @Prop({
    type: Object,
    default: (): SubscriptionConfig => {
      const now = new Date();
      return {
        plan: 'free',
        status: 'active',
        startDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(
          now.getTime() + 365 * 24 * 60 * 60 * 1000,
        ), // 1 año
        amount: 0,
        currency: DEFAULT_CURRENCY,
        autoRenew: false,
        retryAttempts: 0,
        maxRetryAttempts: 7,
        subscriptionHistory: [],
      };
    },
  })
  subscription: SubscriptionConfig;

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

// Índices para suscripción (consultas frecuentes en SubscriptionGuard y cron jobs)
TenantSchema.index({ 'subscription.plan': 1 }); // Filtrar por plan
TenantSchema.index({ 'subscription.status': 1 }); // Filtrar por status
TenantSchema.index({ 'subscription.currentPeriodEnd': 1 }); // Para cron jobs
TenantSchema.index({ 'subscription.autoRenew': 1, 'subscription.currentPeriodEnd': 1 }); // Para renovaciones