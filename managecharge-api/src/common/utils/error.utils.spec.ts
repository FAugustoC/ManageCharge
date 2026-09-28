import { getErrorMessage, getErrorStack } from './error.utils';

/**
 * Pruebas de las utilidades de errores
 *
 * @description Verifican que obtener el mensaje de un error nunca
 * falle, sin importar qué se haya lanzado.
 *
 * Ejecutar: npm test -- error.utils
 */
describe('Utilidades de errores', () => {
  describe('getErrorMessage()', () => {
    it('lee el mensaje de un Error normal', () => {
      expect(getErrorMessage(new Error('Tarjeta rechazada'))).toBe('Tarjeta rechazada');
    });

    it('funciona con subclases de Error (como los errores de Stripe)', () => {
      class CardError extends Error {}
      expect(getErrorMessage(new CardError('Fondos insuficientes'))).toBe('Fondos insuficientes');
    });

    it('acepta un texto lanzado directamente', () => {
      expect(getErrorMessage('Algo falló')).toBe('Algo falló');
    });

    it('acepta un objeto con propiedad message', () => {
      expect(getErrorMessage({ message: 'Error de red' })).toBe('Error de red');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['un número', 500],
      ['un objeto sin message', { code: 'E1' }],
      ['un Error sin mensaje', new Error('')],
    ])('usa el mensaje de respaldo con %s', (_label, value) => {
      expect(getErrorMessage(value)).toBe('Error desconocido');
    });

    it('permite personalizar el mensaje de respaldo', () => {
      expect(getErrorMessage(undefined, 'Error al cobrar')).toBe('Error al cobrar');
    });
  });

  describe('getErrorStack()', () => {
    it('devuelve la traza de un Error', () => {
      expect(getErrorStack(new Error('x'))).toContain('Error: x');
    });

    it('devuelve undefined si no es un Error', () => {
      expect(getErrorStack('texto')).toBeUndefined();
      expect(getErrorStack(undefined)).toBeUndefined();
    });
  });
});
