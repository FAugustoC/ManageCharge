import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsArray,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingType, ServiceType } from '../../../common/index.js';

/**
 * DTO para configuración de cuotas personalizadas
 */
export class InstallmentConfigDto {
  @ApiProperty({
    description: 'Número de cuota (1, 2, 3...)',
    example: 1,
    minimum: 1,
  })
  @IsNumber({}, { message: 'El número de cuota debe ser un número' })
  @Min(1, { message: 'El número de cuota debe ser al menos 1' })
  number: number;

  @ApiProperty({
    description: 'Porcentaje del total que representa esta cuota',
    example: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber({}, { message: 'El porcentaje debe ser un número' })
  @Min(1, { message: 'El porcentaje debe ser al menos 1' })
  @Max(100, { message: 'El porcentaje no puede exceder 100' })
  percentage: number;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento de esta cuota (opcional)',
    example: '2026-02-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato válido (YYYY-MM-DD)' })
  dueDate?: string;
}

/**
 * DTO para crear un nuevo Service
 * 
 * @description Define y valida los datos necesarios para
 * registrar un nuevo servicio/contrato.
 * 
 * Nota: tenantId y createdBy se asignan automáticamente
 * desde el token JWT del usuario autenticado.
 */
export class CreateServiceDto {
  /**
   * ID del cliente al que se le cobra
   */
  @ApiProperty({
    description: 'ID del cliente al que pertenece este servicio',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId({ message: 'El clientId debe ser un ID de MongoDB válido' })
  clientId: string;

  /**
   * Nombre del servicio
   */
  @ApiProperty({
    description: 'Nombre del servicio',
    example: 'Desarrollo de sitio web corporativo',
    minLength: 2,
    maxLength: 200,
  })
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  name: string;

  /**
   * Descripción del servicio
   */
  @ApiPropertyOptional({
    description: 'Descripción detallada del servicio',
    example: 'Sitio web de 5 páginas con diseño responsivo, incluye hosting por 1 año',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(1000, { message: 'La descripción no puede exceder 1000 caracteres' })
  description?: string;

  /**
   * Tipo de servicio
   */
  @ApiPropertyOptional({
    description: 'Tipo de servicio',
    enum: ServiceType,
    example: ServiceType.WEBSITE,
  })
  @IsOptional()
  @IsEnum(ServiceType, { message: 'El tipo de servicio no es válido' })
  serviceType?: ServiceType;

  /**
   * Monto total del servicio
   */
  @ApiProperty({
    description: 'Monto total del servicio',
    example: 6000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0, { message: 'El monto no puede ser negativo' })
  totalAmount: number;

  /**
   * Moneda
   */
  @ApiPropertyOptional({
    description: 'Código de moneda (ISO 4217)',
    example: 'GTQ',
    default: 'GTQ',
  })
  @IsOptional()
  @IsString({ message: 'La moneda debe ser texto' })
  @MinLength(3, { message: 'La moneda debe tener 3 caracteres' })
  @MaxLength(3, { message: 'La moneda debe tener 3 caracteres' })
  currency?: string;

  /**
   * Tipo de facturación
   */
  @ApiProperty({
    description: 'Tipo de facturación/cobro',
    enum: BillingType,
    example: BillingType.INSTALLMENTS,
  })
  @IsEnum(BillingType, { message: 'El tipo de facturación no es válido' })
  billingType: BillingType;

  /**
   * Número de cuotas (requerido si billingType es INSTALLMENTS)
   */
  @ApiPropertyOptional({
    description: 'Número de cuotas (requerido para pagos en cuotas)',
    example: 6,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El número de cuotas debe ser un número' })
  @Min(1, { message: 'Debe haber al menos 1 cuota' })
  @Max(60, { message: 'No puede haber más de 60 cuotas' })
  installmentsCount?: number;

  /**
   * Configuración de cuotas personalizadas (opcional)
   * Si no se envía, las cuotas se dividen en partes iguales
   */
  @ApiPropertyOptional({
    description: 'Configuración de cuotas personalizadas (los porcentajes deben sumar 100)',
    type: [InstallmentConfigDto],
    example: [
      { number: 1, percentage: 50, dueDate: '2026-02-15' },
      { number: 2, percentage: 10, dueDate: '2026-03-15' },
      { number: 3, percentage: 10, dueDate: '2026-04-15' },
      { number: 4, percentage: 10, dueDate: '2026-05-15' },
      { number: 5, percentage: 10, dueDate: '2026-06-15' },
      { number: 6, percentage: 10, dueDate: '2026-07-15' },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'La configuración de cuotas debe ser un array' })
  @ValidateNested({ each: true })
  @Type(() => InstallmentConfigDto)
  installmentsConfig?: InstallmentConfigDto[];

  /**
   * Fecha de inicio del servicio
   */
  @ApiPropertyOptional({
    description: 'Fecha de inicio del servicio',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de inicio debe tener formato válido (YYYY-MM-DD)' })
  startDate?: string;

  /**
   * Fecha de fin del servicio
   */
  @ApiPropertyOptional({
    description: 'Fecha de fin del servicio (opcional)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin debe tener formato válido (YYYY-MM-DD)' })
  endDate?: string;

  /**
   * Notas internas
   */
  @ApiPropertyOptional({
    description: 'Notas internas sobre el servicio',
    example: 'Cliente referido por Juan. Prioridad alta.',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
  notes?: string;
}