import { PartialType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto.js';

/**
 * DTO para actualizar un Tenant
 * 
 * @description Extiende CreateTenantDto pero hace todos los campos opcionales.
 * PartialType() convierte automáticamente todos los campos a opcionales.
 * 
 * Esto permite actualizar solo los campos que se envían en el request,
 * sin requerir todos los campos obligatorios del CreateTenantDto.
 */
export class UpdateTenantDto extends PartialType(CreateTenantDto) {}