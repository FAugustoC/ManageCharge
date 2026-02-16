import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '../enums/index.js';

/**
 * Guard para verificar suscripción premium activa
 *
 * @description Verifica que el tenant tenga una suscripción
 * premium activa leyendo la información del JWT (request.user).
 *
 * NO consulta la base de datos directamente.
 * Lee los datos que ya vienen en el token JWT,
 * lo que lo hace más rápido y evita dependencias circulares.
 *
 * IMPORTANTE: Este guard debe usarse DESPUÉS de JwtAuthGuard
 * que ya carga la información del usuario en request.user.
 *
 * @example
 * @UseGuards(JwtAuthGuard, SubscriptionGuard)
 * @Post('send-notification')
 * async sendNotification() {}
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {

  // ✅ Sin constructor - No necesita inyección de dependencias
  
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Verificar que el usuario existe
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Verificar que tiene tenantId
    if (!user.tenantId) {
      throw new ForbiddenException(
        'No tienes un tenant asociado a tu cuenta',
      );
    }

    // Verificar que tiene información de suscripción
    // Si no tiene suscripción en el JWT, se trata como FREE
    if (!user.subscription) {
      throw new ForbiddenException(
        'Esta función requiere una suscripción premium. ' +
          'Actualiza tu plan en Configuración → Suscripciones',
      );
    }

    const { plan, status, currentPeriodEnd } = user.subscription;

    // Verificar que no es FREE
    if (plan === SubscriptionPlan.FREE || !plan) {
      throw new ForbiddenException(
        'Esta función requiere una suscripción premium. ' +
          'Actualiza tu plan en Configuración → Suscripciones',
      );
    }

    // Verificar que el status es ACTIVE
    if (status !== SubscriptionStatus.ACTIVE) {
      const messages: Record<string, string> = {
        [SubscriptionStatus.GRACE_PERIOD]:
          'Tu suscripción está en periodo de gracia. ' +
          'Actualiza tu método de pago para mantener el acceso.',
        [SubscriptionStatus.EXPIRED]:
          'Tu suscripción ha expirado. ' +
          'Renueva tu plan en Configuración → Suscripciones',
        [SubscriptionStatus.CANCELLED]:
          'Tu suscripción fue cancelada. ' +
          'Puedes reactivarla en Configuración → Suscripciones',
      };

      throw new ForbiddenException(
        messages[status] ||
          'Tu suscripción no está activa. ' +
          'Verifica tu plan en Configuración → Suscripciones',
      );
    }

    // Verificar que el periodo no expiró
    if (currentPeriodEnd) {
      const now = new Date();
      const periodEnd = new Date(currentPeriodEnd);

      if (now > periodEnd) {
        throw new ForbiddenException(
          'Tu periodo de suscripción ha vencido. ' +
            'Renueva tu plan en Configuración → Suscripciones',
        );
      }
    }

    // ✅ Todo OK - tiene acceso premium
    return true;
  }
}