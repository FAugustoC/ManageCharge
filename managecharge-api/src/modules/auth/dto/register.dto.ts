import {
  IsString,
  IsEmail,
  IsOptional,
  IsMongoId,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para Registro
 * 
 * @description Valida los datos para registrar un nuevo usuario.
 * Este DTO es específico para registro público (sin rol admin).
 */
export class RegisterDto {
  @ApiPropertyOptional({
    description: 'ID del tenant (opcional para crear nuevo tenant)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId({ message: 'El tenantId debe ser un ID de MongoDB válido' })
  tenantId?: string;

  @ApiProperty({
    description: 'Email del usuario',
    example: 'nuevo@ejemplo.com',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiProperty({
    description: 'Contraseña (mínimo 8 caracteres, una mayúscula, una minúscula, un número)',
    example: 'MiPassword123',
    minLength: 8,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]+$/,
    { message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número' }
  )
  password: string;

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

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '+52 555 123 4567',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;
}