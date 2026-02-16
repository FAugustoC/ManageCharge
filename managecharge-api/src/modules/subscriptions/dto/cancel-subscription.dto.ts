import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para cancelar suscripción
 * 
 * @description El tenant cancela pero mantiene acceso
 * hasta el fin del periodo pagado
 */
export class CancelSubscriptionDto {
  /**
   * Razón de la cancelación (opcional)
   * 
   * @description Ayuda a entender por qué los usuarios cancelan
   * @example 'Muy caro', 'No uso todas las funciones', 'Cambio de negocio'
   */
  @ApiPropertyOptional({
    description: 'Razón de la cancelación',
    example: 'No necesito las notificaciones automáticas por ahora',
  })
  @IsOptional()
  @IsString({ message: 'La razón debe ser texto' })
  @MaxLength(500, { message: 'La razón no puede exceder 500 caracteres' })
  reason?: string;
}