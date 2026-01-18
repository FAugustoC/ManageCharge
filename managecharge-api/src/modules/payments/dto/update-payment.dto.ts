import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePaymentDto } from './create-payment.dto.js';

/**
 * DTO para actualizar un Payment
 * 
 * @description Permite actualizar datos del pago.
 * No permite cambiar el serviceId.
 */
export class UpdatePaymentDto extends PartialType(
  OmitType(CreatePaymentDto, ['serviceId'] as const),
) {}