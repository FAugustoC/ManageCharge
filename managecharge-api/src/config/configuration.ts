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
    // Fuente única de verdad para los reintentos de cobro
    retryMaxAttempts: readNumber('SUBSCRIPTION_RETRY_MAX_ATTEMPTS', 7, {
      min: 1,
      max: 30,
      integer: true,
    }),
    gracePeriodDays: readNumber('SUBSCRIPTION_GRACE_PERIOD_DAYS', 7, {
      min: 1,
      max: 30,
      integer: true,
    }),

    // Habilitar/deshabilitar automatización
    autoChargeEnabled: process.env.SUBSCRIPTION_AUTO_CHARGE_ENABLED === 'true',
    autoDowngradeEnabled: process.env.SUBSCRIPTION_AUTO_DOWNGRADE_ENABLED === 'true',

    // Cron de renovaciones. Por defecto: cada hora, en punto.
    // No se limita a un rango de horas UTC: cada tenant se evalúa con
    // su propio horario local (8am-8pm), y la regla de un intento por
    // día evita cobros repetidos aunque el cron corra muchas veces.
    cronSchedule: process.env.SUBSCRIPTION_RETRY_CRON || '0 0 * * * *',
  },

});

export default configuration;
