import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para la dirección del Tenant
 * 
 * @description Valida los campos de dirección cuando se proporcionan
 */
export class TenantAddressDto {
  @ApiPropertyOptional({ 
    description: 'Calle y número',
    example: 'Av. La Reforma 13-70, Edf. Real Reforma Piso 9, Of. 9010'
  })
  @IsOptional()
  @IsString({ message: 'La calle debe ser texto' })
  @MaxLength(200, { message: 'La calle no puede exceder 200 caracteres' })
  street?: string;

  @ApiPropertyOptional({ 
    description: 'Ciudad',
    example: 'Ciudad de Guatemala'
  })
  @IsOptional()
  @IsString({ message: 'La ciudad debe ser texto' })
  @MaxLength(100, { message: 'La ciudad no puede exceder 100 caracteres' })
  city?: string;

  @ApiPropertyOptional({ 
    description: 'Departamento, Estado u otra división',
    example: 'Departamento de Guatemala'
  })
  @IsOptional()
  @IsString({ message: 'El estado debe ser texto' })
  @MaxLength(100, { message: 'El estado no puede exceder 100 caracteres' })
  state?: string;

  @ApiPropertyOptional({ 
    description: 'Código postal',
    example: '01010'
  })
  @IsOptional()
  @IsString({ message: 'El código postal debe ser texto' })
  @MaxLength(20, { message: 'El código postal no puede exceder 20 caracteres' })
  postalCode?: string;

  @ApiPropertyOptional({ 
    description: 'País',
    example: 'Guatemala'
  })
  @IsOptional()
  @IsString({ message: 'El país debe ser texto' })
  @MaxLength(100, { message: 'El país no puede exceder 100 caracteres' })
  country?: string;
}

/**
 * DTO para información bancaria del Tenant
 */
export class TenantBankInfoDto {
  @ApiPropertyOptional({ 
    description: 'Nombre del banco',
    example: 'Banco Industrial'
  })
  @IsOptional()
  @IsString({ message: 'El nombre del banco debe ser texto' })
  @MaxLength(100, { message: 'El nombre del banco no puede exceder 100 caracteres' })
  bankName?: string;

  @ApiPropertyOptional({ 
    description: 'Número de cuenta',
    example: '0123456789'
  })
  @IsOptional()
  @IsString({ message: 'El número de cuenta debe ser texto' })
  @MaxLength(50, { message: 'El número de cuenta no puede exceder 50 caracteres' })
  accountNumber?: string;

  @ApiPropertyOptional({ 
    description: 'Tipo de cuenta',
    example: 'Cuenta Monetaria'
  })
  @IsOptional()
  @IsString({ message: 'El tipo de cuenta debe ser texto' })
  @MaxLength(50, { message: 'El tipo de cuenta no puede exceder 50 caracteres' })
  accountType?: string;

  @ApiPropertyOptional({ 
    description: 'Titular de la cuenta',
    example: 'Agencia Digital GT S.A.'
  })
  @IsOptional()
  @IsString({ message: 'El titular debe ser texto' })
  @MaxLength(200, { message: 'El titular no puede exceder 200 caracteres' })
  accountHolder?: string;

  @ApiPropertyOptional({ 
    description: 'CLABE interbancaria',
    example: '012345678901234567'
  })
  @IsOptional()
  @IsString({ message: 'La CLABE debe ser texto' })
  @MaxLength(50, { message: 'La CLABE no puede exceder 50 caracteres' })
  routingNumber?: string;

  @ApiPropertyOptional({ 
    description: 'Notas adicionales para el pago',
    example: 'Incluir RFC en la referencia'
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  notes?: string;
}

/**
 * DTO para crear un nuevo Tenant
 * 
 * @description Define y valida los datos necesarios para
 * registrar una nueva empresa o freelancer en ManageCharge
 */
export class CreateTenantDto {
  @ApiProperty({
    description: 'Nombre del tenant (empresa o persona)',
    example: 'Agencia Digital GT',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser texto' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Slug único para URLs (solo letras minúsculas, números y guiones)',
    example: 'agencia-digital-gt',
  })
  @IsString({ message: 'El slug debe ser texto' })
  @MinLength(2, { message: 'El slug debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El slug no puede exceder 50 caracteres' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  slug: string;

  @ApiProperty({
    description: 'Email principal de contacto',
    example: 'contacto@agenciadigital.gt',
  })
  @IsEmail({}, { message: 'El email debe tener un formato válido' })
  email: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '+502 1234 5678',
  })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Nombre legal de la empresa',
    example: 'Agencia Digital GT S.A.',
  })
  @IsOptional()
  @IsString({ message: 'El nombre de empresa debe ser texto' })
  @MaxLength(200, { message: 'El nombre de empresa no puede exceder 200 caracteres' })
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Sitio web del tenant',
    example: 'https://agenciadigital.gt',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El sitio web debe ser una URL válida' })
  website?: string;

  @ApiPropertyOptional({
    description: 'Dirección física del tenant',
    type: TenantAddressDto,
  })
  @IsOptional()
  @IsObject({ message: 'La dirección debe ser un objeto' })
  @ValidateNested()
  @Type(() => TenantAddressDto)
  address?: TenantAddressDto;

  @ApiPropertyOptional({
    description: 'URL del logo del tenant',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsUrl({}, { message: 'El logo debe ser una URL válida' })
  logo?: string;

  @ApiPropertyOptional({
    description: 'Información bancaria para recibir pagos',
    type: TenantBankInfoDto,
  })
  @IsOptional()
  @IsObject({ message: 'La información bancaria debe ser un objeto' })
  @ValidateNested()
  @Type(() => TenantBankInfoDto)
  bankInfo?: TenantBankInfoDto;
}