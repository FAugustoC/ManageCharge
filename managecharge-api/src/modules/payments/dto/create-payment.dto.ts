import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para crear un nuevo Payment manualmente
 * 
 * @description Normalmente los pagos se crean automáticamente
 * al crear un servicio, pero este DTO permite crear pagos
 * adicionales si es necesario.
 */
export class CreatePaymentDto {
  /**
   * ID del servicio al que pertenece el pago
   */
  @ApiProperty({
    description: 'ID del servicio',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'El serviceId debe ser un ID de MongoDB válido' })
  serviceId: string;

  /**
   * Número de pago/cuota
   */
  @ApiProperty({
    description: 'Número de pago (1, 2, 3...)',
    example: 1,
    minimum: 1,
  })
  @IsNumber({}, { message: 'El número de pago debe ser un número' })
  @Min(1, { message: 'El número de pago debe ser al menos 1' })
  paymentNumber: number;

  /**
   * Descripción del pago
   */
  @ApiPropertyOptional({
    description: 'Descripción o concepto del pago',
    example: 'Cuota 1 de 6 - Anticipo',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;

  /**
   * Monto del pago
   */
  @ApiProperty({
    description: 'Monto del pago',
    example: 1000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0, { message: 'El monto no puede ser negativo' })
  amount: number;

  /**
   * Porcentaje que representa del total
   */
  @ApiProperty({
    description: 'Porcentaje del total del servicio',
    example: 16.67,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber({}, { message: 'El porcentaje debe ser un número' })
  @Min(0, { message: 'El porcentaje no puede ser negativo' })
  @Max(100, { message: 'El porcentaje no puede exceder 100' })
  percentage: number;

  /**
   * Fecha de vencimiento
   */
  @ApiProperty({
    description: 'Fecha de vencimiento del pago',
    example: '2026-02-15',
  })
  @IsDateString({}, { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' })
  dueDate: string;

  /**
   * Notas
   */
  @ApiPropertyOptional({
    description: 'Notas internas sobre el pago',
    example: 'Anticipo acordado antes de iniciar el proyecto',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
  notes?: string;
}