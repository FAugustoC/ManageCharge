import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para Login
 * 
 * @description Valida los datos de inicio de sesión
 * con email y contraseña (autenticación LOCAL)
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'usuario@ejemplo.com',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiPassword123',
    minLength: 8,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;
}