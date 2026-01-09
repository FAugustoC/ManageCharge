import { UserRole } from '../enums/index.js';

/**
 * Payload del JWT (lo que se almacena dentro del token)
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  iat?: number;
  exp?: number;
}

/**
 * Usuario autenticado (disponible en el request)
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}