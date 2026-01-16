import { PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto.js';

/**
 * DTO para actualizar un Client
 * 
 * @description Extiende CreateClientDto pero hace todos los campos opcionales.
 * Permite actualizar solo los campos que se envían en el request.
 */
export class UpdateClientDto extends PartialType(CreateClientDto) {}