import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto.js';

/**
 * DTO para actualizar un Service
 * 
 * @description Extiende CreateServiceDto pero hace todos los campos opcionales.
 * Omite clientId porque no se puede cambiar el cliente de un servicio.
 */
export class UpdateServiceDto extends PartialType(
  OmitType(CreateServiceDto, ['clientId'] as const),
) {}