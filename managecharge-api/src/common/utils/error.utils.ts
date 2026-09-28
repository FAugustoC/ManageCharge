/**
 * Utilidades para manejar errores de forma segura
 *
 * @description En JavaScript se puede lanzar CUALQUIER cosa, no solo
 * objetos Error:
 *
 *   throw new Error('falló');   // lo normal
 *   throw 'falló';              // un texto
 *   throw { code: 500 };        // un objeto cualquiera
 *   throw undefined;            // incluso nada
 *
 * Por eso, con "strict" activado, TypeScript trata el error de un
 * catch como `unknown` (desconocido) y no permite escribir
 * `error.message` sin antes verificar qué es. Si el código asumiera
 * que siempre es un Error y llegara un texto, `error.message` daría
 * undefined, y si llegara `undefined`, el propio catch lanzaría un
 * nuevo error ("Cannot read properties of undefined").
 *
 * Estas funciones hacen esa verificación en un solo lugar.
 *
 * @example
 * try {
 *   await stripe.charge(...);
 * } catch (error) {
 *   this.logger.error(getErrorMessage(error), getErrorStack(error));
 * }
 */

/**
 * Obtener un mensaje legible de cualquier error
 *
 * @param error - Lo que se haya lanzado (desconocido)
 * @param fallback - Mensaje a usar si no hay uno disponible
 */
export function getErrorMessage(
  error: unknown,
  fallback = 'Error desconocido',
): string {
  // Caso normal: un objeto Error o una subclase (StripeError, MongoError...)
  if (error instanceof Error) {
    return error.message || fallback;
  }

  // Alguien lanzó un texto directamente
  if (typeof error === 'string') {
    return error || fallback;
  }

  // Un objeto que no es Error pero tiene una propiedad "message" de texto
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message || fallback;
  }

  return fallback;
}

/**
 * Obtener la traza (stack trace) de un error, si existe
 *
 * @description La traza indica en qué archivo y línea ocurrió el error.
 * Solo los objetos Error la tienen; para cualquier otra cosa devuelve
 * undefined, que el Logger de NestJS acepta sin problema.
 */
export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
