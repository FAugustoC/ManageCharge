import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../enums/index.js';

/**
 * Guard de Tenant
 * 
 * Verifica que el usuario solo acceda a recursos de su tenant.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super Admin tiene acceso a todo
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const requestTenantId =
      request.params.tenantId ||
      request.body?.tenantId ||
      request.query?.tenantId;

    if (!requestTenantId) {
      return true;
    }

    if (requestTenantId !== user.tenantId) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a recursos de otro tenant',
      );
    }

    return true;
  }
}