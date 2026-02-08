import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Tipos de datos que se pueden exportar
 */
export enum ExportType {
  /** Exportar todos los pagos de un tenant */
  PAYMENTS = 'payments',
  
  /** Exportar todos los clientes de un tenant */
  CLIENTS = 'clients',
  
  /** Exportar todos los servicios de un tenant */
  SERVICES = 'services',
  
  /** Exportar reporte completo del tenant */
  FULL_REPORT = 'full_report',
}

/**
 * DTO para solicitar exportación de datos
 * 
 * @description Define qué datos exportar y en qué rango de fechas.
 * El super admin puede exportar datos de cualquier tenant para
 * propósitos de soporte o análisis.
 */
export class ExportDataDto {
  @ApiProperty({
    description: 'ID del tenant cuyos datos se van a exportar',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  tenantId: string;

  @ApiProperty({
    description: 'Tipo de datos a exportar',
    enum: ExportType,
    example: ExportType.PAYMENTS,
  })
  @IsEnum(ExportType, {
    message: 'El tipo de exportación debe ser: payments, clients, services o full_report',
  })
  exportType: ExportType;

  @ApiProperty({
    description: 'Fecha de inicio del rango (opcional, formato ISO)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'Fecha de fin del rango (opcional, formato ISO)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}