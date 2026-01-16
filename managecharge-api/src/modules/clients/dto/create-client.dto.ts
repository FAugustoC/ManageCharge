import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsObject,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para la dirección del Client
 */
export class ClientAddressDto {
  @ApiPropertyOptional({
    description: 'Calle y número',
    example: '6ta Avenida 12-34, Zona 10',
  })
  @IsOptional()
  @IsString({ message: 'La calle debe ser texto' })
  @MaxLength(200, { message: 'La calle no puede exceder 200 caracteres' })
  street?: string;

  @ApiPropertyOptional({
    description: 'Ciudad',
    example: 'Ciudad de Guatemala',
  })
  @IsOptional()
  @IsString({ message: 'La ciudad debe ser texto' })
  @MaxLength(100, { message: 'La ciudad no puede exceder 100 caracteres' })
  city?: string;

  @ApiPropertyOptional({
    description: 'Estado o departamento',
    example: 'Guatemala',
  })
  @IsOptional()
  @IsString({ message: 'El estado debe ser texto' })
  @MaxLength(100, { message: 'El estado no puede exceder 100 caracteres' })
  state?: string;

  @ApiPropertyOptional({
    description: 'Código postal',
    example: '01010',
  })
  @IsOptional()
  @IsString({ message: 'El código postal debe ser texto' })
  @MaxLength(20, { message: 'El código postal no puede exceder 20 caracteres' })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'País',
    example: 'Guatemala',
  })
  @IsOptional()
  @IsString({ message: 'El país debe ser texto' })
  @MaxLength(100, { message: 'El país no puede exceder 100 caracteres' })
  country?: string;
}

/**
 * DTO para crear un nuevo Client
 * 
 * @description Define y valida los datos necesarios para
 * registrar un nuevo cliente en el sistema.
 * 
 * Nota: tenantId y createdBy se asignan automáticamente
 * desde el token JWT del usuario autenticado.
 */
export class CreateClientDto {
  /**
   * Nombre del cliente o persona de contacto
   */
  @ApiProperty({
    description: 'Nombre completo del cliente o persona de contacto',
    example: 'María García López',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  /**
   * Email del cliente
   */
  @ApiProperty({
    description: 'Email del cliente (único dentro del tenant)',
    example: 'maria@empresa.com',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  /**
   * Teléfono del cliente
   */
  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '+502 5555-1234',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;

  /**
   * Nombre de la empresa
   */
  @ApiPropertyOptional({
    description: 'Nombre de la empresa del cliente',
    example: 'Restaurante El Buen Sabor S.A.',
  })
  @IsOptional()
  @IsString({ message: 'El nombre de empresa debe ser texto' })
  @MaxLength(200, { message: 'El nombre de empresa no puede exceder 200 caracteres' })
  company?: string;

  /**
   * Identificación fiscal (NIT, RFC, etc.)
   */
  @ApiPropertyOptional({
    description: 'Identificación fiscal (NIT, RFC, RUC)',
    example: '12345678-9',
  })
  @IsOptional()
  @IsString({ message: 'El NIT/RFC debe ser texto' })
  @MaxLength(30, { message: 'El NIT/RFC no puede exceder 30 caracteres' })
  taxId?: string;

  /**
   * Dirección del cliente
   */
  @ApiPropertyOptional({
    description: 'Dirección del cliente',
    type: ClientAddressDto,
  })
  @IsOptional()
  @IsObject({ message: 'La dirección debe ser un objeto' })
  @ValidateNested()
  @Type(() => ClientAddressDto)
  address?: ClientAddressDto;

  /**
   * Sitio web del cliente
   */
  @ApiPropertyOptional({
    description: 'Sitio web del cliente',
    example: 'https://www.restaurante.com',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El sitio web debe ser una URL válida' })
  website?: string;

  /**
   * Notas internas
   */
  @ApiPropertyOptional({
    description: 'Notas internas sobre el cliente',
    example: 'Prefiere que le llamen por la tarde. Paga siempre puntual.',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(1000, { message: 'Las notas no pueden exceder 1000 caracteres' })
  notes?: string;
}