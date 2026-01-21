import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/index.js';
import { JwtAuthGuard } from './guards/index.js';
import { Public, CurrentUser } from '../../common/index.js';
import { GoogleProfile } from './strategies/index.js';

/**
 * Interfaz para el request con usuario de Google
 */
interface GoogleRequest {
  user: GoogleProfile;
}

/**
 * Interfaz para el usuario autenticado
 */
interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
}

/**
 * DTO para refrescar tokens

class RefreshTokenDto {
  refreshToken: string;
}
*/

/**
 * AuthController
 * 
 * @description Controlador que maneja todos los endpoints de autenticación:
 * - Registro de usuarios
 * - Login con email/password
 * - Login con Google OAuth
 * - Refresh de tokens
 * - Obtener perfil del usuario actual
 * 
 * Base URL: /api/v1/auth
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * POST /auth/register
   * Registrar un nuevo usuario
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description: 'Crea una nueva cuenta de usuario con email y contraseña',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 409,
    description: 'El email ya está registrado',
  })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);

    return {
      success: true,
      message: 'Usuario registrado exitosamente',
      data: result,
    };
  }

  /**
   * POST /auth/login
   * Iniciar sesión con email y contraseña
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Autentica un usuario con email y contraseña',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas',
  })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    return {
      success: true,
      message: 'Login exitoso',
      data: result,
    };
  }

  /**
   * POST /auth/refresh
   * Refrescar tokens de acceso
  */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refrescar tokens',
    description: 'Obtiene nuevos tokens de acceso y refresh usando un refresh token válido',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Tokens renovados exitosamente',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido o expirado',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {  // ← Nombre más descriptivo
    const tokens = await this.authService.refreshTokens(refreshTokenDto.refreshToken);

    return {
      success: true,
      message: 'Tokens renovados exitosamente',
      data: tokens,
    };
  }

  /**
 * GET /auth/profile
 * Obtener perfil del usuario autenticado
 */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth('JWT-auth')  // ← Debe coincidir con el nombre en main.ts
  @ApiOperation({
    summary: 'Obtener perfil',
    description: 'Retorna los datos del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil obtenido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.authService.getProfile(user.userId);

    return {
      success: true,
      data: profile,
    };
  }

  /**
   * GET /auth/google
   * Iniciar flujo de autenticación con Google
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Login con Google',
    description: 'Redirige a Google para autenticación OAuth',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirige a Google',
  })
  async googleAuth() {
    // Este método no hace nada, solo activa el guard de Google
    // que redirige al usuario a la página de login de Google
  }

  /**
   * GET /auth/google/callback
   * Callback de Google OAuth
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Callback de Google',
    description: 'Endpoint al que Google redirige después de la autenticación',
  })
  @ApiResponse({
    status: 200,
    description: 'Login con Google exitoso',
  })
  async googleCallback(@Req() req: GoogleRequest) {
    const result = await this.authService.googleLogin(req.user);

    return {
      success: true,
      message: 'Login con Google exitoso',
      data: result,
    };
  }
}