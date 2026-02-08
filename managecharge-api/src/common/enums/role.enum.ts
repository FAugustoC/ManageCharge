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


/**
 * Jerarquía de roles para comparaciones de permisos
 * 
 * @description Asigna un nivel numérico a cada rol.
 * Útil para verificar si un usuario tiene suficientes permisos.
 * Número más alto = más permisos
 * 
 * @example
 * Verificar si un usuario tiene permisos suficientes
 * -- if (RoleHierarchy[user.role] >= RoleHierarchy[UserRole.TENANT_ADMIN]) {
 * El usuario es admin o super admin
 * }
 */
export const RoleHierarchy = {
  [UserRole.SUPER_ADMIN]: 3,   // Acceso total
  [UserRole.TENANT_ADMIN]: 2,  // Acceso a su tenant
  [UserRole.TENANT_USER]: 1,   // Acceso limitado
} as const;