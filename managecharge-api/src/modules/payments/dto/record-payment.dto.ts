import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../../common/index.js';

/**
 * DTO para registrar un pago (marcar como pagado)
 * 
 * @description Se usa cuando el cliente paga una cuota.
 * Permite registrar el monto pagado, método de pago y comprobante.
 */
export class RecordPaymentDto {
  /**
   * Monto pagado
   */
  @ApiProperty({
    description: 'Monto efectivamente pagado',
    example: 1000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0, { message: 'El monto no puede ser negativo' })
  paidAmount: number;

  /**
   * Fecha del pago
   */
  @ApiPropertyOptional({
    description: 'Fecha en que se realizó el pago (default: hoy)',
    example: '2026-02-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' })
  paidDate?: string;

  /**
   * Método de pago
   */
  @ApiPropertyOptional({
    description: 'Método de pago utilizado',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'El método de pago no es válido' })
  paymentMethod?: PaymentMethod;

  /**
   * Número de referencia
   */
  @ApiPropertyOptional({
    description: 'Número de referencia o transacción',
    example: 'TRF-2026-001234',
  })
  @IsOptional()
  @IsString({ message: 'El número de referencia debe ser texto' })
  @MaxLength(100, { message: 'El número de referencia no puede exceder 100 caracteres' })
  referenceNumber?: string;

  /**
   * Notas del pago
   */
  @ApiPropertyOptional({
    description: 'Notas sobre el pago',
    example: 'Pago recibido por transferencia bancaria',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
  notes?: string;
}