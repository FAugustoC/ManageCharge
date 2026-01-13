import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { UserRole, AuthProvider } from '../../../common/index.js';

/**
 * User Entity (Schema de MongoDB)
 * 
 * @description Representa a un usuario del sistema.
 * Cada usuario pertenece a un Tenant (excepto SUPER_ADMIN).
 * 
 * Relaciones:
 * - Un User pertenece a un Tenant (many-to-one)
 * - Un User puede crear muchos Clients
 * - Un User puede registrar muchos Payments
 */
@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  /**
   * Referencia al Tenant al que pertenece este usuario
   * 
   * @description Es null solo para usuarios SUPER_ADMIN
   * que tienen acceso global a todos los tenants.
   * 
   * El tipo ObjectId referencia a la colección 'tenants'
   */
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'Tenant',
    required: false, // Null para SUPER_ADMIN
    index: true, // Índice para búsquedas rápidas por tenant
  })
  tenantId?: MongooseSchema.Types.ObjectId;

  /**
   * Email del usuario (único globalmente)
   * 
   * @description Se usa para login y comunicaciones.
   * Debe ser único en toda la plataforma, no solo dentro del tenant.
   */
  @Prop({ 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true,
    index: true,
  })
  email: string;

  /**
   * Contraseña hasheada
   * 
   * @description Nunca se guarda en texto plano.
   * Se hashea con bcrypt antes de guardar.
   * Es opcional porque los usuarios OAuth no tienen password.
   */
  @Prop({ required: false })
  password?: string;

  /**
   * Nombre del usuario
   */
  @Prop({ required: true, trim: true })
  firstName: string;

  /**
   * Apellido del usuario
   */
  @Prop({ required: true, trim: true })
  lastName: string;

  /**
   * Teléfono del usuario (opcional)
   */
  @Prop({ trim: true })
  phone?: string;

  /**
   * Rol del usuario en el sistema
   * 
   * @description Define los permisos:
   * - SUPER_ADMIN: Acceso total a la plataforma
   * - TENANT_ADMIN: Administra su tenant
   * - TENANT_USER: Usuario regular del tenant
   */
  @Prop({ 
    type: String, 
    enum: UserRole, 
    default: UserRole.TENANT_USER,
    index: true,
  })
  role: UserRole;

  /**
   * Proveedor de autenticación
   * 
   * @description Indica cómo se registró el usuario:
   * - LOCAL: Email y contraseña
   * - GOOGLE: Google OAuth
   * - APPLE: Apple Sign In
   */
  @Prop({ 
    type: String, 
    enum: AuthProvider, 
    default: AuthProvider.LOCAL,
  })
  authProvider: AuthProvider;

  /**
   * ID del proveedor OAuth (Google ID, Apple ID)
   * 
   * @description Se usa para vincular la cuenta local
   * con el proveedor externo.
   */
  @Prop({ trim: true })
  providerId?: string;

  /**
   * URL del avatar/foto de perfil
   */
  @Prop({ trim: true })
  avatar?: string;

  /**
   * ¿El usuario está activo?
   * 
   * @description false = cuenta suspendida o eliminada
   */
  @Prop({ default: true, index: true })
  isActive: boolean;

  /**
   * ¿El email ha sido verificado?
   * 
   * @description Para usuarios LOCAL, deben verificar su email.
   * Para usuarios OAuth, se considera verificado automáticamente.
   */
  @Prop({ default: false })
  emailVerified: boolean;

  /**
   * Fecha del último login
   */
  @Prop()
  lastLoginAt?: Date;

  /**
   * Token para verificación de email
   */
  @Prop()
  emailVerificationToken?: string;

  /**
   * Expiración del token de verificación
   */
  @Prop()
  emailVerificationExpires?: Date;

  /**
   * Token para resetear contraseña
   */
  @Prop()
  passwordResetToken?: string;

  /**
   * Expiración del token de reset
   */
  @Prop()
  passwordResetExpires?: Date;

  /**
   * Timestamps automáticos
   */
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Tipo del documento User en MongoDB
 */
export type UserDocument = User & Document;

/**
 * Schema de Mongoose
 */
export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Índice compuesto para buscar usuarios dentro de un tenant
 */
UserSchema.index({ tenantId: 1, email: 1 });
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ authProvider: 1, providerId: 1 });

/**
 * Virtual para nombre completo
 * 
 * @description Permite acceder a user.fullName
 * sin guardarlo en la base de datos
 */
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Configurar toJSON para incluir virtuals
 */
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });