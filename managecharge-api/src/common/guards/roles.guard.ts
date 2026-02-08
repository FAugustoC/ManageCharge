import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, RoleHierarchy } from '../enums/role.enum.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * Guard que verifica si el usuario tiene los roles necesarios
 * 
 * @description Compara los roles del usuario con los roles
 * requeridos por el endpoint usando el decorador @Roles()
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Obtener roles requeridos del decorador @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay roles requeridos, permitir acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtener usuario del request
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Verificar si el usuario tiene alguno de los roles permitidos
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de estos roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Verifica si un rol tiene suficiente jerarquía
   * 
   * @param userRole - Rol del usuario
   * @param requiredRole - Rol mínimo requerido
   * @returns true si el usuario tiene suficientes permisos
   */
  static hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
  }
}