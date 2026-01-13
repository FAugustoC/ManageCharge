import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

/**
 * DTO para actualizar un User
 * 
 * @description Extiende CreateUserDto pero:
 * - Todos los campos son opcionales (PartialType)
 * - Excluye campos que no deberían actualizarse directamente:
 *   - email: Requiere verificación especial
 *   - password: Tiene su propio endpoint de cambio
 *   - authProvider: No se puede cambiar después de crear
 *   - providerId: No se puede cambiar después de crear
 */
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password', 'authProvider', 'providerId'] as const),
) {}