/**
 * Roles de usuario en el sistema ManageCharge
 * 
 * @description Define los tres niveles de acceso:
 * - SUPER_ADMIN: Propietario de ManageCharge (control total)
 * - TENANT_ADMIN: Administrador de una empresa/freelancer suscrito
 * - TENANT_USER: Usuario regular dentro de un tenant
 */
export enum UserRole {
  /** Propietario de ManageCharge - Acceso global a todos los tenants */
  SUPER_ADMIN = 'super_admin',
  
  /** Administrador del tenant - Gestiona su propio espacio */
  TENANT_ADMIN = 'tenant_admin',
  
  /** Usuario del tenant - Acceso limitado dentro del tenant */
  TENANT_USER = 'tenant_user',
}