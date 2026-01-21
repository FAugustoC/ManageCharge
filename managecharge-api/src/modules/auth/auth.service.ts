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
    tenantId: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * AuthService
 * 
 * @description Servicio que maneja toda la lógica de autenticación:
 * - Registro de nuevos usuarios (crea Tenant + Usuario automáticamente)
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
  ) { }

  /**
   * Generar slug único a partir del nombre de empresa
   */
  private generateSlug(companyName: string): string {
    const baseSlug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
      .replace(/\s+/g, '-') // Espacios a guiones
      .replace(/-+/g, '-') // Múltiples guiones a uno
      .trim();

    // Agregar timestamp para garantizar unicidad
    const timestamp = Date.now().toString(36);
    return `${baseSlug}-${timestamp}`;
  }

  /**
   * Registrar un nuevo usuario
   * 
   * @description Crea automáticamente:
   * 1. Un Tenant (espacio de trabajo)
   * 2. Un Usuario como TENANT_ADMIN
   * 
   * @param registerDto - Datos de registro
   * @returns Usuario y Tenant creados con tokens de acceso
   * @throws ConflictException si el email ya existe
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Verificar si el email ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // 1. Crear el Tenant automáticamente
    const slug = this.generateSlug(registerDto.companyName);

    const tenant = await this.tenantsService.create({
      name: registerDto.companyName,
      slug: slug,
      email: registerDto.email,
      phone: registerDto.phone,
      companyName: registerDto.companyName,
    });

    // 2. Crear el Usuario como TENANT_ADMIN
    const user = await this.usersService.create({
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      tenantId: tenant._id.toString(),
      authProvider: AuthProvider.LOCAL,
      role: UserRole.TENANT_ADMIN, // Dueño del tenant
    });

    // 3. Generar tokens
    const tokens = await this.generateTokens({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: tenant._id.toString(),
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: tenant._id.toString(),
      },
      tenant: {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
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

    // Obtener datos del tenant
    let tenantData = { id: '', name: '', slug: '' };

    if (user.tenantId) {
      const tenant = await this.tenantsService.findById(user.tenantId.toString());
      tenantData = {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
      };
    }

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
        tenantId: user.tenantId?.toString() || '',
      },
      tenant: tenantData,
      ...tokens,
    };
  }

  /**
   * Autenticar con Google OAuth
   * 
   * @param googleProfile - Perfil del usuario de Google
   * @returns Usuario autenticado con tokens de acceso
   * 
   * @description Si el usuario no existe, crea Tenant + Usuario automáticamente.
   * Si ya existe, simplemente inicia sesión.
   */
  async googleLogin(googleProfile: GoogleProfile): Promise<AuthResponse> {
    // Buscar usuario por providerId de Google
    let user = await this.usersService.findByProvider(
      AuthProvider.GOOGLE,
      googleProfile.googleId,
    );

    let tenant;

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

        // Obtener tenant existente
        if (user.tenantId) {
          tenant = await this.tenantsService.findById(user.tenantId.toString());
        }
      } else {
        // Crear nuevo Tenant + Usuario con datos de Google
        const companyName = `${googleProfile.firstName} ${googleProfile.lastName}`;
        const slug = this.generateSlug(companyName);

        tenant = await this.tenantsService.create({
          name: companyName,
          slug: slug,
          email: googleProfile.email,
          companyName: companyName,
        });

        user = await this.usersService.create({
          email: googleProfile.email,
          firstName: googleProfile.firstName,
          lastName: googleProfile.lastName,
          avatar: googleProfile.picture,
          tenantId: tenant._id.toString(),
          authProvider: AuthProvider.GOOGLE,
          providerId: googleProfile.googleId,
          role: UserRole.TENANT_ADMIN,
        });
      }
    } else {
      // Usuario existe, obtener su tenant
      if (user.tenantId) {
        tenant = await this.tenantsService.findById(user.tenantId.toString());
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
        tenantId: user.tenantId?.toString() || '',
      },
      tenant: tenant ? {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
      } : { id: '', name: '', slug: '' },
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
    // Obtener configuración desde variables de entorno
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const accessTokenExpiry = this.configService.get<number>('jwt.accessTokenExpiry');
    const refreshTokenExpiry = this.configService.get<number>('jwt.refreshTokenExpiry');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está configurado en las variables de entorno');
    }

    // Crear el payload como objeto plano
    const tokenPayload: Record<string, unknown> = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };

    // Generar Access Token
    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: jwtSecret,
      expiresIn: accessTokenExpiry,
    });

    // Generar Refresh Token
    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: jwtSecret,
      expiresIn: refreshTokenExpiry,
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

    // Obtener datos del tenant si existe
    let tenantData: { id: string; name: string; slug: string } | null = null;

    if (user.tenantId) {
      const tenant = await this.tenantsService.findById(user.tenantId.toString());
      tenantData = {
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
      };
    }

    return {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId?.toString(),
      tenant: tenantData,
      avatar: user.avatar,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}