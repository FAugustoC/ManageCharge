import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para cobro manual por super admin
 * 
 * @description Usado en soporte cuando un tenant
 * tiene problemas de pago y necesita ayuda
 */
export class ManualChargeDto {
  /**
   * Razón del cobro manual
   * 
   * @description Obligatorio para auditoría
   * @example 'Customer updated card - Support ticket #1234'
   */
  @ApiProperty({
    description: 'Razón del cobro manual (para auditoría)',
    example: 'Customer called support and updated payment method',
  })
  @IsString({ message: 'La razón debe ser texto' })
  @IsNotEmpty({ message: 'La razón es requerida' })
  @MaxLength(500, { message: 'La razón no puede exceder 500 caracteres' })
  reason: string;
}