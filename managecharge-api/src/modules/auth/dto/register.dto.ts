import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para registro de nuevos usuarios
 * 
 * @description Al registrarse, se crea automáticamente:
 * - Un Tenant (espacio de trabajo)
 * - Un Usuario como TENANT_ADMIN (dueño del tenant)
 */
export class RegisterDto {
  /**
   * Email del usuario (será también el email del tenant)
   */
  @ApiProperty({
    description: 'Email del usuario',
    example: 'maria@gmail.com',
  })
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  /**
   * Contraseña del usuario
   */
  @ApiProperty({
    description: 'Contraseña (mínimo 8 caracteres, debe incluir mayúscula, minúscula y número)',
    example: 'Password123',
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número',
  })
  password: string;

  /**
   * Nombre del usuario
   */
  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'María',
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
    example: 'García',
  })
  @IsString({ message: 'El apellido debe ser texto' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El apellido no puede exceder 50 caracteres' })
  lastName: string;

  /**
   * Nombre de la empresa o marca personal
   */
  @ApiProperty({
    description: 'Nombre de la empresa, agencia o marca personal',
    example: 'María Diseños GT',
  })
  @IsString({ message: 'El nombre de empresa debe ser texto' })
  @MinLength(2, { message: 'El nombre de empresa debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre de empresa no puede exceder 100 caracteres' })
  companyName: string;

  /**
   * Teléfono de contacto (opcional)
   */
  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '+502 5555-1234',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;
}