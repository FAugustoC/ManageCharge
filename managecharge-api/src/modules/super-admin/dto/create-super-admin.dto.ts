import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para crear un nuevo usuario Super Admin
 * 
 * @description Permite al super admin principal (August) crear
 * usuarios secundarios con rol de super admin para su equipo de soporte.
 */
export class CreateSuperAdminDto {
  @ApiProperty({
    description: 'Nombre completo del nuevo super admin',
    example: 'María García',
  })
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Email del nuevo super admin',
    example: 'maria@managecharge.com',
  })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @ApiProperty({
    description: 'Contraseña temporal (el usuario deberá cambiarla)',
    example: 'TempPass123!',
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Rol o cargo del nuevo super admin',
    example: 'Soporte Técnico',
    required: false,
  })
  @IsOptional()
  @IsString()
  role?: string;
}