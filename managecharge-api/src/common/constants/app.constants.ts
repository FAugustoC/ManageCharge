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

/**
 * Zona horaria por defecto para tenants nuevos
 *
 * @description Debe ser un identificador IANA válido (ej: 'America/Guatemala',
 * 'America/Mexico_City', 'America/Los_Angeles'). Los nombres inventados como
 * 'America/California' NO existen y hacen que Intl.DateTimeFormat lance error.
 *
 * @see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
export const DEFAULT_TIMEZONE = 'America/Guatemala';

/** Moneda por defecto para tenants nuevos (código ISO 4217) */
export const DEFAULT_CURRENCY = 'USD';

/** Porcentaje de comisión de ManageCharge */
export const PLATFORM_FEE_PERCENT = 5;

/** Límites de paginación */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

/** Configuración de contraseñas */
export const PASSWORD_CONFIG = {
  MIN_LENGTH: 8,
  SALT_ROUNDS: 10,
} as const;


/**
 * Features por plan de suscripción
 */
export const SUBSCRIPTION_FEATURES = {
  FREE: {
    clients: true,
    services: true,
    payments: true,
    pushNotifications: true,
    emailNotifications: false, // ❌ Solo push
    whatsappNotifications: false, // ❌ Solo push
    maxClients: undefined,
    maxServices: undefined, 
  },
  PREMIUM_MONTHLY: {
    clients: true,
    services: true,
    payments: true,
    pushNotifications: true,
    emailNotifications: true,
    whatsappNotifications: true,
    maxClients: undefined,
    maxServices: undefined,
  },
  PREMIUM_ANNUAL: {
    clients: true,
    services: true,
    payments: true,
    pushNotifications: true,
    emailNotifications: true,
    whatsappNotifications: true,
    maxClients: undefined,
    maxServices: undefined,
  },
} as const;

/**
 * Configuración de reintentos de cobro
 */
export const SUBSCRIPTION_RETRY_CONFIG = {
  MAX_ATTEMPTS: 7, // 7 días de gracia
  GRACE_PERIOD_DAYS: 7,
} as const;