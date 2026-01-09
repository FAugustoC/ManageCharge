/**
 * Constantes globales de la aplicación ManageCharge
 */

/** Nombre de la aplicación */
export const APP_NAME = 'ManageCharge';

/** Versión actual del API */
export const API_VERSION = 'v1';

/** Prefijo global para todas las rutas del API */
export const API_PREFIX = `api/${API_VERSION}`;

/** Días antes del vencimiento para enviar notificaciones */
export const NOTIFICATION_DAYS = {
  FIRST: 30,
  SECOND: 15,
  THIRD: 7,
  FINAL: 1,
} as const;

/** Porcentaje de comisión de ManageCharge */
export const PLATFORM_FEE_PERCENT = 5;

/** Límites de paginación */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

/** Configuración de JWT */
export const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
} as const;

/** Configuración de contraseñas */
export const PASSWORD_CONFIG = {
  MIN_LENGTH: 8,
  SALT_ROUNDS: 10,
} as const;