import { configuration } from './configuration';

/**
 * Pruebas de validación de variables de entorno (reintentos de cobro)
 *
 * @description configuration() se ejecuta al arrancar el API. Si una
 * variable es inválida debe lanzar un error claro ("fail fast") en
 * lugar de arrancar con un valor equivocado.
 *
 * Ejecutar: npm test -- configuration
 */
describe('configuration() - reintentos de cobro', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Copia limpia del entorno para que cada prueba no afecte a las demás
    process.env = { ...originalEnv };
    delete process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS;
    delete process.env.SUBSCRIPTION_RETRY_SCHEDULE_DAYS;
    delete process.env.SUBSCRIPTION_RETRY_MAX_ATTEMPTS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const setEnv = (grace?: string, schedule?: string) => {
    if (grace !== undefined) process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS = grace;
    if (schedule !== undefined) process.env.SUBSCRIPTION_RETRY_SCHEDULE_DAYS = schedule;
  };

  it('sin variables usa 15 días y el calendario 1,2,4,6,9,12,15', () => {
    const { subscriptions } = configuration();
    expect(subscriptions.gracePeriodDays).toBe(15);
    expect(subscriptions.retryScheduleDays).toEqual([1, 2, 4, 6, 9, 12, 15]);
    expect(subscriptions.retryMaxAttempts).toBe(7);
  });

  it('el máximo de intentos se deriva del calendario', () => {
    setEnv('10', '1,3,5,10');
    expect(configuration().subscriptions.retryMaxAttempts).toBe(4);
  });

  it('acepta espacios alrededor de las comas', () => {
    setEnv('15', ' 1, 2 ,4,6, 9,12,15 ');
    expect(configuration().subscriptions.retryScheduleDays).toEqual([1, 2, 4, 6, 9, 12, 15]);
  });

  it.each([
    ['texto', '1,dos,4', 'enteros'],
    ['decimales', '1,2.5,4', 'enteros'],
    ['comas vacías', '1,,4', 'enteros'],
    ['día cero', '0,2,4', 'entre 1 y 15'],
    ['día fuera de la gracia', '1,2,20', 'entre 1 y 15'],
    ['desordenado', '1,4,2', 'ascendente'],
    ['repetido', '1,2,2,4', 'ascendente'],
  ])('rechaza calendario con %s', (_label, schedule, expected) => {
    setEnv('15', schedule);
    expect(() => configuration()).toThrow(expected);
  });

  it('exige un calendario propio si la gracia es menor al calendario por defecto', () => {
    setEnv('7');
    expect(() => configuration()).toThrow('SUBSCRIPTION_RETRY_SCHEDULE_DAYS');
  });

  it('avisa si todavía existe la variable antigua SUBSCRIPTION_RETRY_MAX_ATTEMPTS', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.SUBSCRIPTION_RETRY_MAX_ATTEMPTS = '7';

    configuration();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('SUBSCRIPTION_RETRY_MAX_ATTEMPTS ya no se usa'),
    );
    warn.mockRestore();
  });
});

/**
 * Pruebas del secreto de firma de webhooks de Stripe
 *
 * @description Sin STRIPE_WEBHOOK_SECRET no se puede verificar que un
 * webhook viene de Stripe. En producción es obligatorio.
 */
describe('configuration() - STRIPE_WEBHOOK_SECRET', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS;
    delete process.env.SUBSCRIPTION_RETRY_SCHEDULE_DAYS;
    delete process.env.SUBSCRIPTION_RETRY_MAX_ATTEMPTS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('acepta un secreto con formato whsec_', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_abc123';
    expect(configuration().stripe.webhookSecret).toBe('whsec_abc123');
  });

  it('en desarrollo permite arrancar sin secreto', () => {
    process.env.NODE_ENV = 'development';
    expect(configuration().stripe.webhookSecret).toBe('');
  });

  it('en producción NO arranca sin secreto (fail fast)', () => {
    process.env.NODE_ENV = 'production';
    expect(() => configuration()).toThrow(
      'STRIPE_WEBHOOK_SECRET es obligatoria en producción',
    );
  });

  it('rechaza un valor con formato incorrecto (ej: la clave sk_ por error)', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'sk_test_123';
    expect(() => configuration()).toThrow('debe empezar con "whsec_"');
  });
});
