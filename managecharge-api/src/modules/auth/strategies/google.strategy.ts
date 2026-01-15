import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';

/**
 * Interfaz para los datos del perfil de Google
 */
export interface GoogleProfile {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  googleId: string;
}

/**
 * GoogleStrategy
 * 
 * @description Estrategia de Passport para autenticación con Google OAuth 2.0.
 * Esta estrategia solo se activa si las credenciales de Google están configuradas.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    // Obtener valores de configuración desde variables de entorno
    const clientID = configService.get<string>('google.clientId') || 'not-configured';
    const clientSecret = configService.get<string>('google.clientSecret') || 'not-configured';
    const callbackURL = configService.get<string>('google.callbackUrl') || 'not-configured';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  /**
   * Validar y procesar el perfil de Google
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, name, emails, photos } = profile;

    const googleProfile: GoogleProfile = {
      googleId: id,
      email: emails?.[0]?.value || '',
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      picture: photos?.[0]?.value,
    };

    done(null, googleProfile);
  }
}