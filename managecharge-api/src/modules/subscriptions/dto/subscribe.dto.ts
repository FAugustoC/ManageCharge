import {
  IsString,
  IsEnum,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../../common/enums/index.js';

/**
 * DTO para contratar una suscripción premium
 * 
 * @description Se usa cuando un tenant FREE decide
 * actualizar a premium mensual o anual
 */
export class SubscribeDto {
  /**
   * Plan de suscripción deseado
   * 
   * @description Solo puede ser premium_monthly o premium_annual
   * (no se puede "suscribir" a FREE, eso es un downgrade)
   */
  @ApiProperty({
    description: 'Plan de suscripción',
    enum: [SubscriptionPlan.PREMIUM_MONTHLY, SubscriptionPlan.PREMIUM_ANNUAL],
    example: SubscriptionPlan.PREMIUM_MONTHLY,
  })
  @IsEnum(SubscriptionPlan, {
    message: 'El plan debe ser premium_monthly o premium_annual',
  })
  @IsNotEmpty({ message: 'El plan es requerido' })
  plan: SubscriptionPlan.PREMIUM_MONTHLY | SubscriptionPlan.PREMIUM_ANNUAL;

  /**
   * Token del método de pago generado por frontend
   * 
   * @description Para Stripe: token generado por Stripe.js
   * Nunca se envía información de tarjeta real al backend
   * 
   * @example 'pm_1ABC123xyz' (Stripe PaymentMethod ID)
   */
  @ApiProperty({
    description:
      'Token del método de pago generado por Stripe.js o SDK del proveedor',
    example: 'pm_1ABC123xyz',
  })
  @IsString({ message: 'El token de pago debe ser texto' })
  @IsNotEmpty({ message: 'El token de pago es requerido' })
  @MinLength(10, { message: 'El token de pago es inválido (muy corto)' })
  @MaxLength(200, { message: 'El token de pago es inválido (muy largo)' })
  paymentMethodToken: string;
}