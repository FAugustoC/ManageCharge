import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUrl,
  IsMongoId,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, AuthProvider } from '../../../common/index.js';

/**
 * DTO para crear un nuevo User
 * 
 * @description Define y valida los datos necesarios para
 * registrar un nuevo usuario en el sistema.
 */
export class CreateUserDto {
  /**
   * ID del Tenant al que pertenece el usuario
   * 
   * @description Opcional solo para SUPER_ADMIN.
   * Requerido para TENANT_ADMIN y TENANT_USER.
   */
  @ApiPropertyOptional({
    description: 'ID del tenant al que pertenece (opcional para SUPER_ADMIN)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'El tenantId debe ser un ID de MongoDB válido' })
  tenantId?: string;

  /**
   * Email del usuario
   */
  @ApiProperty({
    description: 'Email único del usuario',
    example: 'usuario@ejemplo.com',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  /**
   * Contraseña del usuario
   * 
   * @description Requerida para registro LOCAL.
   * Opcional para registro con OAuth (Google/Apple).
   * 
   * Requisitos:
   * - Mínimo 8 caracteres
   * - Al menos una mayúscula
   * - Al menos una minúscula
   * - Al menos un número
   */
  @ApiPropertyOptional({
    description: 'Contraseña (mínimo 8 caracteres, una mayúscula, una minúscula, un número)',
    example: 'MiPassword123',
    minLength: 8,
  })
  @IsOptional()
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/,
    { message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número' }
  )
  password?: string;

  /**
   * Nombre del usuario
   */
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El nombre no puede exceder 50 caracteres' })
  firstName: string;

  /**
   * Apellido del usuario
   */
  @ApiProperty({
    description: 'Apellido del usuario',
    example: 'Pérez',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'El apellido debe ser texto' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El apellido no puede exceder 50 caracteres' })
  lastName: string;

  /**
   * Teléfono del usuario (opcional)
   */
  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '+52 555 123 4567',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;

  /**
   * Rol del usuario
   * 
   * @description Por defecto es TENANT_USER.
   * Solo un SUPER_ADMIN puede crear otros SUPER_ADMIN.
   */
  @ApiPropertyOptional({
    description: 'Rol del usuario en el sistema',
    enum: UserRole,
    default: UserRole.TENANT_USER,
    example: UserRole.TENANT_ADMIN,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser un valor válido' })
  role?: UserRole;

  /**
   * Proveedor de autenticación
   * 
   * @description Por defecto es LOCAL (email/password).
   */
  @ApiPropertyOptional({
    description: 'Proveedor de autenticación',
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
    example: AuthProvider.LOCAL,
  })
  @IsOptional()
  @IsEnum(AuthProvider, { message: 'El proveedor debe ser un valor válido' })
  authProvider?: AuthProvider;

  /**
   * ID del proveedor OAuth
   * 
   * @description Solo para usuarios registrados con Google/Apple.
   */
  @ApiPropertyOptional({
    description: 'ID único del proveedor OAuth (Google ID, Apple ID)',
    example: '123456789012345678901',
  })
  @IsOptional()
  @IsString({ message: 'El providerId debe ser texto' })
  providerId?: string;

  /**
   * URL del avatar
   */
  @ApiPropertyOptional({
    description: 'URL de la foto de perfil',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El avatar debe ser una URL válida' })
  avatar?: string;
}