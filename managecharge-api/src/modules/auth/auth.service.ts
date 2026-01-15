import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/index.js';
import { TenantsService } from '../tenants/index.js';
import { LoginDto, RegisterDto } from './dto/index.js';
import { GoogleProfile } from './strategies/index.js';
import { 
  JwtPayload, 
  AuthProvider, 
  UserRole,
} from '../../common/index.js';

/**
 * Interfaz para la respuesta de autenticación
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId?: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * AuthService
 * 
 * @description Servicio que maneja toda la lógica de autenticación:
 * - Registro de nuevos usuarios
 * - Login con email/password
 * - Login con Google OAuth
 * - Generación y validación de tokens JWT
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Registrar un nuevo usuario
   * 
   * @param registerDto - Datos de registro
   * @returns Usuario creado con tokens de acceso
   * @throws ConflictException si el email ya existe
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Verificar si el email ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    
    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Si se proporciona tenantId, verificar que exista
    if (registerDto.tenantId) {
      await this.tenantsService.findById(registerDto.tenantId);
    }

    // Crear el usuario
    const user = await this.usersService.create({
      ...registerDto,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.TENANT_USER, // Por defecto, usuarios nuevos son TENANT_USER
    });

    // Generar tokens
    const tokens = await this.generateTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId?.toString() ?? null,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId?.toString(),
      },
      ...tokens,
    };
  }

  /**
   * Iniciar sesión con email y contraseña
   * 
   * @param loginDto - Credenciales de login
   * @returns Usuario autenticado con tokens de acceso
   * @throws UnauthorizedException si las credenciales son inválidas
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    // Buscar usuario por email (con contraseña para validar)
    const user = await this.usersService.findByEmailWithPassword(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que el usuario use autenticación LOCAL
    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new BadRequestException(
        `Esta cuenta usa ${user.authProvider} para iniciar sesión`
      );
    }

    // Verificar que el usuario tenga contraseña
    if (!user.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const isPasswordValid = await this.usersService.comparePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que el usuario esté activo
    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada');
    }

    // Actualizar fecha de último login
    await this.usersService.updateLastLogin(user._id.toString());

    // Generar tokens
    const tokens = await this.generateTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId?.toString() ?? null,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId?.toString(),
      },
      ...tokens,
    };
  }

  /**
   * Autenticar con Google OAuth
   * 
   * @param googleProfile - Perfil del usuario de Google
   * @returns Usuario autenticado con tokens de acceso
   * 
   * @description Si el usuario no existe, lo crea automáticamente.
   * Si ya existe con el mismo email, vincula la cuenta de Google.
   */
  async googleLogin(googleProfile: GoogleProfile): Promise<AuthResponse> {
    // Buscar usuario por providerId de Google
    let user = await this.usersService.findByProvider(
      AuthProvider.GOOGLE,
      googleProfile.googleId,
    );

    // Si no existe por providerId, buscar por email
    if (!user) {
      const existingUser = await this.usersService.findByEmail(googleProfile.email);

      if (existingUser) {
        // El email ya existe con otro método de autenticación
        if (existingUser.authProvider !== AuthProvider.GOOGLE) {
          throw new ConflictException(
            `El email ${googleProfile.email} ya está registrado con ${existingUser.authProvider}. ` +
            'Por favor, inicia sesión con ese método.'
          );
        }
        user = existingUser;
      } else {
        // Crear nuevo usuario con datos de Google
        user = await this.usersService.create({
          email: googleProfile.email,
          firstName: googleProfile.firstName,
          lastName: googleProfile.lastName,
          avatar: googleProfile.picture,
          authProvider: AuthProvider.GOOGLE,
          providerId: googleProfile.googleId,
          role: UserRole.TENANT_USER,
        });
      }
    }

    // Verificar que el usuario esté activo
    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta ha sido desactivada');
    }

    // Actualizar fecha de último login
    await this.usersService.updateLastLogin(user._id.toString());

    // Generar tokens
    const tokens = await this.generateTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId?.toString() ?? null,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId?.toString(),
      },
      ...tokens,
    };
  }

  /**
   * Refrescar tokens de acceso
   * 
   * @param refreshToken - Token de refresco actual
   * @returns Nuevos tokens de acceso
   * @throws UnauthorizedException si el token es inválido
   */
  async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verificar y decodificar el refresh token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Buscar el usuario
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Token inválido');
      }

      // Generar nuevos tokens
      return this.generateTokens({
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: user.tenantId?.toString() ?? null,
      });
    } catch {
      throw new UnauthorizedException('Token de refresco inválido o expirado');
    }
  }

  /**
 * Generar tokens JWT (access y refresh)
 * 
 * @param payload - Datos a incluir en el token
 * @returns Access token y refresh token
 */
private async generateTokens(
  payload: JwtPayload,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Obtener configuración
  const jwtSecret = this.configService.get<string>('jwt.secret') || 'default-secret';

  // Crear el payload como objeto plano
    const tokenPayload: Record<string, unknown> = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
    };

    // Generar Access Token (15 minutos)
    const accessToken = await this.jwtService.signAsync(tokenPayload, {
        secret: jwtSecret,
        expiresIn: 900, // 15 minutos en segundos
    });

    // Generar Refresh Token (7 días)
    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
        secret: jwtSecret,
        expiresIn: 604800, // 7 días en segundos
    });

    return { accessToken, refreshToken };
}

  /**
   * Obtener perfil del usuario actual
   * 
   * @param userId - ID del usuario autenticado
   * @returns Datos del usuario
   */
  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);

    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId?.toString(),
      avatar: user.avatar,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}