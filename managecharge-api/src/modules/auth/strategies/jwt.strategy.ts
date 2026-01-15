import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/index.js';
import { JwtPayload } from '../../../common/index.js';

/**
 * JwtStrategy
 * 
 * @description Estrategia de Passport para validar tokens JWT.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está configurado en las variables de entorno');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validar el payload del token
   */
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId?.toString(),
    };
  }
}