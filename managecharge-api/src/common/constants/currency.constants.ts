/**
 * Constantes y utilidades de monedas
 *
 * @description Los procesadores de pago (Stripe, CyberSource) reciben los
 * montos en la "unidad mínima" de cada moneda. Para la mayoría de monedas
 * esa unidad es el centavo (1 USD = 100 centavos), pero algunas monedas
 * no tienen decimales y se envían tal cual.
 *
 * En ManageCharge TODOS los montos internos se manejan en unidades
 * completas (ej: 12.99 USD, 12000 CLP). La conversión a unidad mínima
 * se hace únicamente dentro de cada provider, justo antes de llamar
 * a la API externa.
 */

/**
 * Monedas sin decimales según Stripe
 *
 * @description Para estas monedas NO se multiplica por 100.
 * Ejemplo: 12000 CLP se envía a Stripe como 12000 (no 1,200,000).
 *
 * @see https://docs.stripe.com/currencies#zero-decimal
 */
export const ZERO_DECIMAL_CURRENCIES: readonly string[] = [
  'BIF', // Franco burundés
  'CLP', // Peso chileno
  'DJF', // Franco yibutiano
  'GNF', // Franco guineano
  'JPY', // Yen japonés
  'KMF', // Franco comorense
  'KRW', // Won surcoreano
  'MGA', // Ariary malgache
  'PYG', // Guaraní paraguayo
  'RWF', // Franco ruandés
  'UGX', // Chelín ugandés
  'VND', // Dong vietnamita
  'VUV', // Vatu de Vanuatu
  'XAF', // Franco CFA de África Central
  'XOF', // Franco CFA de África Occidental
  'XPF', // Franco CFP
] as const;

/**
 * Verificar si una moneda no tiene decimales
 *
 * @param currency - Código ISO 4217 (ej: 'USD', 'clp')
 */
export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes(currency.toUpperCase());
}

/**
 * Convertir un monto en unidades completas a la unidad mínima de la moneda
 *
 * @example
 * toMinorUnits(12.99, 'USD')  // 1299
 * toMinorUnits(100, 'GTQ')    // 10000
 * toMinorUnits(12000, 'CLP')  // 12000  (sin decimales)
 */
export function toMinorUnits(amount: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

/**
 * Convertir un monto en unidad mínima a unidades completas
 *
 * @description Útil para interpretar montos que devuelve el proveedor
 * (por ejemplo, en los webhooks de Stripe).
 *
 * @example
 * fromMinorUnits(1299, 'USD')   // 12.99
 * fromMinorUnits(12000, 'CLP')  // 12000
 */
export function fromMinorUnits(amount: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) {
    return amount;
  }
  return amount / 100;
}
