import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_CONFIG } from '../../../common/constants/app.constants.js';

/**
 * DTO para crear un nuevo usuario Super Admin
 *
 * @description Permite a un super admin crear otros usuarios con rol
 * de super admin para el equipo de soporte de ManageCharge.
 *
 * Los campos coinciden con la entidad User (firstName / lastName),
 * que es donde finalmente se guardan.
 */
export class CreateSuperAdminDto {
  @ApiProperty({
    description: 'Nombre del nuevo super admin',
    example: 'María',
  })
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El nombre no puede exceder 50 caracteres' })
  firstName: string;

  @ApiProperty({
    description: 'Apellido del nuevo super admin',
    example: 'García',
  })
  @IsString({ message: 'El apellido debe ser texto' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El apellido no puede exceder 50 caracteres' })
  lastName: string;

  @ApiProperty({
    description: 'Email del nuevo super admin',
    example: 'maria@managecharge.com',
  })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @ApiProperty({
    description:
      'Contraseña temporal (mínimo 8 caracteres, una mayúscula, una minúscula y un número)',
    example: 'TempPass123',
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @MinLength(PASSWORD_CONFIG.MIN_LENGTH, {
    message: `La contraseña debe tener al menos ${PASSWORD_CONFIG.MIN_LENGTH} caracteres`,
  })
  @MaxLength(100, { message: 'La contraseña no puede exceder 100 caracteres' })
  @Matches(PASSWORD_CONFIG.PATTERN, {
    message: PASSWORD_CONFIG.PATTERN_MESSAGE,
  })
  password: string;
}
