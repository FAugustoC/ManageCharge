/**
 * Convierte tiempo de expiración a segundos
 * Acepta formatos: '15m', '7d', '1h', '30s', o números directos
 * 
 * @param expiry - Tiempo en formato string o número
 * @returns Tiempo en segundos
 * 
 * @example
 * parseExpiryToSeconds('15m') // 900
 * parseExpiryToSeconds('7d')  // 604800
 * parseExpiryToSeconds('1h')  // 3600
 * parseExpiryToSeconds(900)   // 900
 */
function parseExpiryToSeconds(expiry: string | number | undefined): number {
  if (typeof expiry === 'number') return expiry;
  if (!expiry) return 900; // Default 15 minutos

  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return parseInt(expiry, 10) || 900;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;              // segundos
    case 'm': return value * 60;         // minutos
    case 'h': return value * 60 * 60;    // horas
    case 'd': return value * 60 * 60 * 24; // días
    default: return value;
  }
}

/**
 * Leer una variable numérica de entorno y validarla
 *
 * @description Si la variable no existe se usa el valor por defecto.
 * Si existe pero es inválida (texto, fuera de rango, decimal donde se
 * espera un entero) se lanza un error y el API NO arranca.
 *
 * Esto se llama "fail fast" (fallar rápido): es preferible que el
 * servidor se niegue a iniciar con un mensaje claro, a que arranque
 * y cobre comisiones o reintentos con un valor equivocado.
 *
 * @example
 * readNumber('PORT', 3000, { min: 1, max: 65535, integer: true })
 */
function readNumber(
  name: string,
  defaultValue: number,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }

  const value = Number(raw);
  const { min, max, integer } = options;

  const isInvalid =
    Number.isNaN(value) ||
    (integer && !Number.isInteger(value)) ||
    (min !== undefined && value < min) ||
    (max !== undefined && value > max);

  if (isInvalid) {
    const rules = [
      integer ? 'entero' : 'número',
      min !== undefined ? `mínimo ${min}` : null,
      max !== undefined ? `máximo ${max}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    throw new Error(
      `Variable de entorno inválida: ${name}="${raw}". Debe ser ${rules}.`,
    );
  }

  return value;
}

/** Calendario de reintentos por defecto (días de gracia en que se cobra) */
const DEFAULT_RETRY_SCHEDULE_DAYS = [1, 2, 4, 6, 9, 12, 15];

/** Días de gracia por defecto */
const DEFAULT_GRACE_PERIOD_DAYS = 15;

/**
 * Leer y validar la configuración de reintentos de cobro
 *
 * @description El calendario (SUBSCRIPTION_RETRY_SCHEDULE_DAYS) indica en
 * qué día del período de gracia se hace cada intento. Ejemplo:
 * "1,2,4,6,9,12,15" = 7 intentos, el primero el día del vencimiento y el
 * último el día 15.
 *
 * El número máximo de intentos NO se configura por separado: es la
 * cantidad de días del calendario. Así es imposible que el calendario
 * diga 7 intentos y otra variable diga 5 (una sola fuente de verdad).
 *
 * Reglas que se validan al arrancar (si fallan, el API no inicia):
 * - Solo números enteros, separados por comas
 * - Cada día entre 1 y los días de gracia
 * - En orden ascendente y sin repetir (un intento por día como máximo)
 */
function readRetryConfig() {
  const gracePeriodDays = readNumber(
    'SUBSCRIPTION_GRACE_PERIOD_DAYS',
    DEFAULT_GRACE_PERIOD_DAYS,
    { min: 1, max: 60, integer: true },
  );

  const raw = process.env.SUBSCRIPTION_RETRY_SCHEDULE_DAYS;
  let retryScheduleDays = DEFAULT_RETRY_SCHEDULE_DAYS;

  if (raw !== undefined && raw.trim() !== '') {
    const parts = raw.split(',').map((part) => part.trim());
    const days = parts.map(Number);

    const invalid = (reason: string) =>
      new Error(
        `Variable de entorno inválida: SUBSCRIPTION_RETRY_SCHEDULE_DAYS="${raw}". ${reason}`,
      );

    if (parts.some((part) => part === '') || days.some((d) => !Number.isInteger(d))) {
      throw invalid('Debe ser una lista de números enteros separados por comas (ej: 1,2,4,6,9,12,15).');
    }

    if (days.some((d) => d < 1 || d > gracePeriodDays)) {
      throw invalid(
        `Cada día debe estar entre 1 y ${gracePeriodDays} (SUBSCRIPTION_GRACE_PERIOD_DAYS).`,
      );
    }

    if (days.some((d, i) => i > 0 && d <= days[i - 1])) {
      throw invalid('Los días deben ir en orden ascendente y sin repetirse.');
    }

    retryScheduleDays = days;
  } else if (
    DEFAULT_RETRY_SCHEDULE_DAYS[DEFAULT_RETRY_SCHEDULE_DAYS.length - 1] >
    gracePeriodDays
  ) {
    // Sin calendario propio pero con una gracia más corta que el
    // calendario por defecto: se exige definirlo para no adivinar.
    throw new Error(
      `SUBSCRIPTION_GRACE_PERIOD_DAYS=${gracePeriodDays} es menor que el calendario ` +
      `por defecto (${DEFAULT_RETRY_SCHEDULE_DAYS.join(',')}). ` +
      'Define SUBSCRIPTION_RETRY_SCHEDULE_DAYS con días dentro de la gracia.',
    );
  }

  // Variable antigua: ya no se usa, se avisa para evitar confusiones
  if (process.env.SUBSCRIPTION_RETRY_MAX_ATTEMPTS !== undefined) {
    console.warn(
      '[Config] SUBSCRIPTION_RETRY_MAX_ATTEMPTS ya no se usa y será ignorada. ' +
      'El número de intentos es la cantidad de días en SUBSCRIPTION_RETRY_SCHEDULE_DAYS ' +
      `(actualmente ${retryScheduleDays.length}). Puedes borrarla de tu .env.`,
    );
  }

  return {
    gracePeriodDays,
    retryScheduleDays,
    retryMaxAttempts: retryScheduleDays.length,
  };
}

/**
 * Configuración centralizada de la aplicación
 * 
 * @description Todas las variables de entorno se leen aquí
 * y se exponen de forma tipada al resto de la aplicación.
 */
export const configuration = () => ({
  app: {
    name: process.env.APP_NAME || 'ManageCharge',
    env: process.env.NODE_ENV || 'development',
    port: readNumber('PORT', 3000, { min: 1, max: 65535, integer: true }),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  },

  database: {
    uri: process.env.MONGODB_URI,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: parseExpiryToSeconds(process.env.JWT_ACCESS_EXPIRY),
    refreshTokenExpiry: parseExpiryToSeconds(process.env.JWT_REFRESH_EXPIRY),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },

  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY,
    callbackUrl: process.env.APPLE_CALLBACK_URL,
  },

  mail: {
    provider: process.env.MAIL_PROVIDER,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.MAIL_FROM_EMAIL,
    fromName: process.env.MAIL_FROM_NAME,
  },

  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    apiUrl: process.env.WHATSAPP_API_URL,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local', // 'local', 's3', 'cloudinary'
    localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    s3Region: process.env.AWS_S3_REGION || 'us-east-1',
    s3AccessKey: process.env.AWS_ACCESS_KEY_ID || '',
    s3SecretKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    /**
     * Comisión de ManageCharge en porcentaje (ej: 5 = 5%, 2.5 = 2.5%)
     * Fuente única de verdad: no existe una constante equivalente.
     */
    platformFeePercent: readNumber('PLATFORM_FEE_PERCENT', 5, {
      min: 0,
      max: 100,
    }),
  },

  subscriptions: {
    // Días de gracia, calendario de reintentos y máximo de intentos
    // (este último se deriva del calendario). Ver readRetryConfig().
    ...readRetryConfig(),

    // Habilitar/deshabilitar automatización
    autoChargeEnabled: process.env.SUBSCRIPTION_AUTO_CHARGE_ENABLED === 'true',
    autoDowngradeEnabled: process.env.SUBSCRIPTION_AUTO_DOWNGRADE_ENABLED === 'true',

    // Cron de renovaciones. Por defecto: cada hora, en punto.
    // No se limita a un rango de horas UTC: cada tenant se evalúa con
    // su propio horario local (8am-8pm), y la regla de máximo un intento
    // por día evita cobros repetidos aunque el cron corra muchas veces.
    cronSchedule: process.env.SUBSCRIPTION_RETRY_CRON || '0 0 * * * *',
  },

});

export default configuration;
