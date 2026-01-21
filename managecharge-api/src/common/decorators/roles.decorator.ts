import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/index.js';

/**
 * Key para almacenar los roles en metadata
 */
export const ROLES_KEY = 'roles';
/**
 * Decorador para especificar qué roles pueden acceder a un endpoint
 * 
 * @param roles - Lista de roles permitidos
 * 
 * @example
 * // Solo SUPER_ADMIN puede acceder
 * @Roles(UserRole.SUPER_ADMIN)
 * 
 * @example
 * // SUPER_ADMIN o TENANT_ADMIN pueden acceder
 * @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);