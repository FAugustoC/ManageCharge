/**
 * Configuración de precios de suscripciones ManageCharge
 * 
 * @description Precios en diferentes monedas según el país del tenant.
 * Los precios se mantienen equivalentes usando tasas de cambio aproximadas.
 */

/**
 * Precios de plan Premium Mensual por moneda
 */
export const PREMIUM_MONTHLY_PRICING = {
  USD: 12.99, // Estados Unidos
  GTQ: 100.0, // Guatemala (~$12.99)
  MXN: 249.0, // México (~$12.99)
  COP: 54900, // Colombia (~$12.99)
  PEN: 48.0, // Perú (~$12.99)
  CRC: 6600, // Costa Rica (~$12.99)
  ARS: 12900, // Argentina (~$12.99)
  CLP: 12000, // Chile (~$12.99)
  UYU: 510, // Uruguay (~$12.99)
  BOB: 90, // Bolivia (~$12.99)
  PYG: 95000, // Paraguay (~$12.99)
  DOP: 760, // República Dominicana (~$12.99)
  HNL: 320, // Honduras (~$12.99)
  NIO: 477, // Nicaragua (~$12.99)
  PAB: 12.99, // Panamá (dólar)
  BRL: 65.0, // Brasil (~$12.99)
  EUR: 12.0, // Europa (~$12.99)
} as const;

/**
 * Precios de plan Premium Anual por moneda
 * Equivalente a 10 meses (23% descuento vs 12 meses)
 */
export const PREMIUM_ANNUAL_PRICING = {
  USD: 119.99, // ~$9.99/mes
  GTQ: 929.0, // ~Q77.42/mes
  MXN: 2299.0, // ~$191.58/mes
  COP: 509900, // ~$42,491/mes
  PEN: 449.0, // ~S/37.42/mes
  CRC: 61900, // ~₡5,158/mes
  ARS: 119900, // ~$9,991/mes
  CLP: 111000, // ~$9,250/mes
  UYU: 4700, // ~$391/mes
  BOB: 829, // ~Bs69/mes
  PYG: 880000, // ~₲73,333/mes
  DOP: 7050, // ~RD$587/mes
  HNL: 2950, // ~L245/mes
  NIO: 4420, // ~C$368/mes
  PAB: 119.99, // ~$9.99/mes
  BRL: 599.0, // ~R$49.92/mes
  EUR: 110.0, // ~€9.17/mes
} as const;

/**
 * Mapeo de código de país (ISO 3166-1 alpha-2) a moneda (ISO 4217)
 */
export const CURRENCY_BY_COUNTRY = {
  US: 'USD', // Estados Unidos
  GT: 'GTQ', // Guatemala
  MX: 'MXN', // México
  CO: 'COP', // Colombia
  PE: 'PEN', // Perú
  CR: 'CRC', // Costa Rica
  AR: 'ARS', // Argentina
  CL: 'CLP', // Chile
  UY: 'UYU', // Uruguay
  BO: 'BOB', // Bolivia
  PY: 'PYG', // Paraguay
  DO: 'DOP', // República Dominicana
  HN: 'HNL', // Honduras
  NI: 'NIO', // Nicaragua
  PA: 'PAB', // Panamá
  BR: 'BRL', // Brasil
  ES: 'EUR', // España
  DEFAULT: 'USD', // Default para países no listados
} as const;

/**
 * Mapeo de nombre de país completo a código ISO
 * Para casos donde el tenant ingresa el país como texto
 */
export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'Estados Unidos': 'US',
  'United States': 'US',
  Guatemala: 'GT',
  México: 'MX',
  Mexico: 'MX',
  Colombia: 'CO',
  Perú: 'PE',
  Peru: 'PE',
  'Costa Rica': 'CR',
  Argentina: 'AR',
  Chile: 'CL',
  Uruguay: 'UY',
  Bolivia: 'BO',
  Paraguay: 'PY',
  'República Dominicana': 'DO',
  'Dominican Republic': 'DO',
  Honduras: 'HN',
  Nicaragua: 'NI',
  Panamá: 'PA',
  Panama: 'PA',
  Brasil: 'BR',
  Brazil: 'BR',
  España: 'ES',
  Spain: 'ES',
};

/**
 * Símbolos de moneda para display
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  GTQ: 'Q',
  MXN: '$',
  COP: '$',
  PEN: 'S/',
  CRC: '₡',
  ARS: '$',
  CLP: '$',
  UYU: '$U',
  BOB: 'Bs',
  PYG: '₲',
  DOP: 'RD$',
  HNL: 'L',
  NIO: 'C$',
  PAB: 'B/.',
  BRL: 'R$',
  EUR: '€',
};

/**
 * Obtener precio de un plan según país
 * 
 * @param plan - 'monthly' o 'annual'
 * @param country - Código de país (ISO 3166-1) o nombre completo
 * @returns Precio y moneda
 */
export function getSubscriptionPrice(
  plan: 'monthly' | 'annual',
  country: string,
): { amount: number; currency: string; symbol: string } {
  // Normalizar código de país
  let countryCode = country.toUpperCase();

  // Si es nombre de país, convertir a código
  if (countryCode.length > 2) {
    countryCode = COUNTRY_NAME_TO_CODE[country] || 'DEFAULT';
  }

  // Obtener moneda
  const currency =
    CURRENCY_BY_COUNTRY[countryCode] || CURRENCY_BY_COUNTRY.DEFAULT;

  // Obtener precio
  const pricing = plan === 'monthly' ? PREMIUM_MONTHLY_PRICING : PREMIUM_ANNUAL_PRICING;
  const amount = pricing[currency] || pricing.USD;

  // Obtener símbolo
  const symbol = CURRENCY_SYMBOLS[currency] || '$';

  return { amount, currency, symbol };
}

/**
 * Calcular ahorro del plan anual
 */
export const ANNUAL_DISCOUNT_PERCENT = 23;

/**
 * Calcular precio mensual equivalente del plan anual
 */
export function getAnnualMonthlyEquivalent(country: string): {
  amount: number;
  currency: string;
  symbol: string;
} {
  const annual = getSubscriptionPrice('annual', country);
  return {
    amount: Math.round((annual.amount / 12) * 100) / 100,
    currency: annual.currency,
    symbol: annual.symbol,
  };
}