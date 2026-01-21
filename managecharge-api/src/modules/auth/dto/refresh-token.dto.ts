import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para refrescar tokens de acceso
 * 
 * @description Define la estructura del body para el endpoint
 * POST /auth/refresh que permite obtener nuevos tokens
 * usando un refresh token válido
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Token de refresco válido obtenido durante el login',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NWE...',
    type: String,
  })
  @IsString({ message: 'El refresh token debe ser un string' })
  @IsNotEmpty({ message: 'El refresh token es obligatorio' })
  refreshToken: string;
}