import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Model } from 'mongoose';
import { UsersService } from '../../users/index.js';
import { JwtPayload } from '../../../common/index.js';
import { Tenant, TenantDocument, SubscriptionConfig } from '../../tenants/index.js';

/**
 * JwtStrategy
 *
 * @description Estrategia de Passport para validar tokens JWT.
 *
 * Carga en request.user:
 * - userId, email, role, tenantId
 * - subscription: Info de suscripción del tenant (para SubscriptionGuard)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,

    // Inyectamos el modelo Tenant para cargar la suscripción
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET no está configurado en las variables de entorno',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validar el payload del token
   *
   * @description Este método se ejecuta en CADA request autenticada.
   * Lo que retorne aquí se convierte en request.user disponible
   * en todos los controllers y guards.
   */
  async validate(payload: JwtPayload) {
    // Verificar que el usuario existe y está activo
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    // Cargar suscripción del tenant
    let subscription: SubscriptionConfig | null = null;

    if (user.tenantId) {
      const tenant = await this.tenantModel
        .findById(user.tenantId)
        .select('subscription') // Solo traemos el campo subscription
        .lean()                  // lean() retorna objeto JS simple (más rápido)
        .exec();

      if (tenant) {
        subscription = tenant.subscription;
      }
    }

    // Este objeto estará disponible como request.user en toda la app
    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId?.toString(),
      subscription, // Ahora el SubscriptionGuard puede leerlo
    };
  }
}