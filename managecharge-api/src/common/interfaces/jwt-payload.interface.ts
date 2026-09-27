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
 *
 * @description Es el objeto que retorna JwtStrategy.validate() en cada
 * request protegida. Se obtiene en los controladores con @CurrentUser().
 *
 * IMPORTANTE: al usarlo como tipo de un parámetro decorado
 * (ej: @CurrentUser() user: AuthenticatedUser) se debe importar con
 * `import type`. Con isolatedModules + emitDecoratorMetadata, TypeScript
 * rechaza un import normal de una interfaz en esa posición (error TS1272),
 * porque intentaría generar metadata de algo que no existe en JavaScript.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
}
