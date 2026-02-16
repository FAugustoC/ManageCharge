import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para actualizar método de pago
 * 
 * @description Permite al tenant actualizar su tarjeta
 * sin cancelar la suscripción
 */
export class UpdatePaymentMethodDto {
  /**
   * Token del nuevo método de pago
   * 
   * @description Generado por Stripe.js en el frontend
   * @example 'pm_1XYZ789abc'
   */
  @ApiProperty({
    description: 'Token del nuevo método de pago',
    example: 'pm_1XYZ789abc',
  })
  @IsString({ message: 'El token de pago debe ser texto' })
  @IsNotEmpty({ message: 'El token de pago es requerido' })
  @MinLength(10, { message: 'El token de pago es inválido' })
  @MaxLength(200, { message: 'El token de pago es inválido' })
  paymentMethodToken: string;
}