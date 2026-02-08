
import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  ForbiddenException 
} from '@nestjs/common';
import { UserRole } from '../../common/enums/index.js';

/**
 * Guard que protege rutas exclusivas de Super Admin
 * 
 * @description Solo permite acceso a usuarios con rol SUPER_ADMIN.
 * Se usa para proteger endpoints críticos del sistema que solo
 * el propietario de ManageCharge (August) debe poder acceder.
 * 
 * @example
 * // En un controller:
 * @UseGuards(JwtAuthGuard, SuperAdminGuard)
 * @Get('dashboard')
 * async getDashboard() { ... }
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Verificar que el usuario existe y tiene rol
    if (!user || !user.role) {
      throw new ForbiddenException(
        'Acceso denegado: Usuario no autenticado'
      );
    }

    // Verificar que el usuario es SUPER_ADMIN
    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Acceso denegado: Se requiere rol de Super Admin'
      );
    }

    return true;
  }
}