import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * SubscriptionsScheduler
 *
 * @description Maneja los cron jobs para renovación automática
 * de suscripciones y downgrade de cuentas expiradas.
 *
 * Cron Jobs:
 * 1. processRenewals - Intenta cobrar suscripciones vencidas
 *    Ejecuta: Cada 2 horas entre 8am-8pm (configurable)
 *
 * 2. processDowngrades - Degrada cuentas que agotaron intentos
 *    Ejecuta: Todos los días a medianoche
 *
 * 3. logDailyStats - Log de estadísticas diarias
 *    Ejecuta: Todos los días a las 6am
 */
@Injectable()
export class SubscriptionsScheduler {
  private readonly logger = new Logger(SubscriptionsScheduler.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Procesar renovaciones automáticas
   *
   * @description Busca tenants con suscripción vencida o en
   * grace period y que tengan autoRenew = true.
   * Respeta el timezone del tenant (solo cobra entre 8am-8pm).
   *
   * Schedule configurable desde .env:
   * SUBSCRIPTION_RETRY_CRON=0 *\/2 8-20 * * *
   *
   * Default: Cada 2 horas entre 8am y 8pm
   */
  @Cron(
    process.env.SUBSCRIPTION_RETRY_CRON || '0 0 */2 * * *',
    {
      name: 'subscription-renewals',
      timeZone: 'UTC',
    },
  )
  async processRenewals(): Promise<void> {
    // Verificar que el cobro automático está habilitado
    const autoChargeEnabled = this.configService.get<boolean>(
      'subscriptions.autoChargeEnabled',
      true,
    );

    if (!autoChargeEnabled) {
      this.logger.debug(
        'Cobro automático deshabilitado. Saltando proceso de renovación.',
      );
      return;
    }

    this.logger.log(
      '🔄 Iniciando proceso de renovaciones automáticas...',
    );

    const startTime = Date.now();

    try {
      await this.subscriptionsService.processRenewalAttempts();

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Proceso de renovaciones completado en ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error en proceso de renovaciones automáticas',
        error.stack,
      );
    }
  }

  /**
   * Procesar downgrades automáticos
   *
   * @description Se ejecuta todos los días a medianoche.
   * Degrada a FREE los tenants que:
   * 1. Agotaron sus 7 intentos de cobro
   * 2. Cancelaron y su periodo ya terminó
   *
   * Schedule fijo: Todos los días a medianoche UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'subscription-downgrades',
    timeZone: 'UTC',
  })
  async processDowngrades(): Promise<void> {
    // Verificar que el downgrade automático está habilitado
    const autoDowngradeEnabled = this.configService.get<boolean>(
      'subscriptions.autoDowngradeEnabled',
      true,
    );

    if (!autoDowngradeEnabled) {
      this.logger.debug(
        'Downgrade automático deshabilitado. Saltando proceso.',
      );
      return;
    }

    this.logger.log(
      '📉 Iniciando proceso de downgrades automáticos...',
    );

    const startTime = Date.now();

    try {
      await this.subscriptionsService.downgradeExpiredSubscriptions();

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Proceso de downgrades completado en ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error en proceso de downgrades automáticos',
        error.stack,
      );
    }
  }

  /**
   * Log de estadísticas diarias
   *
   * @description Se ejecuta todos los días a las 6am UTC.
   * Registra en los logs información del estado
   * de las suscripciones para monitoreo.
   *
   * Schedule fijo: Todos los días a las 6am UTC
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, {
    name: 'subscription-daily-stats',
    timeZone: 'UTC',
  })
  async logDailyStats(): Promise<void> {
    this.logger.log('📊 Generando estadísticas diarias de suscripciones...');

    try {
      const stats =
        await this.subscriptionsService.getSubscriptionStats();

      this.logger.log(
        `📊 Stats del día:
        - Total tenants: ${stats.total}
        - FREE: ${stats.free}
        - Premium Mensual: ${stats.premiumMonthly}
        - Premium Anual: ${stats.premiumAnnual}
        - Grace Period: ${stats.gracePeriod}
        - Expirados hoy: ${stats.expiredToday}
        `,
      );
    } catch (error) {
      this.logger.error(
        '❌ Error al generar estadísticas diarias',
        error.stack,
      );
    }
  }
}