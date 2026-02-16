/**
 * SubscriptionsScheduler
 *
 * @description Maneja los cron jobs para renovación automática
 * de suscripciones y downgrade de cuentas expiradas.
 *
 * Cron Jobs:
 * 1. processRenewals - Configurable desde .env
 * 2. processDowngrades - Fijo: Medianoche
 * 3. logDailyStats - Fijo: 6am
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { SubscriptionsService } from './subscriptions.service.js';

@Injectable()
export class SubscriptionsScheduler implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionsScheduler.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.logger.log('🚀 SubscriptionsScheduler inicializado');
    
    const autoChargeEnabled = this.configService.get<boolean>(
      'subscriptions.autoChargeEnabled',
    );
    const cronSchedule = this.configService.get<string>(
      'subscriptions.cronSchedule',
    );
    
    this.logger.log(`⚙️ autoChargeEnabled: ${autoChargeEnabled}`);
    this.logger.log(`⚙️ cronSchedule desde config: ${cronSchedule}`);
  }

  /**
   * Se ejecuta después de que el módulo se inicializa
   * Registra el cron dinámicamente usando SchedulerRegistry
   */
  onModuleInit() {
    const cronSchedule = this.configService.get<string>(
      'subscriptions.cronSchedule',
      '0 0 */2 * * *', // Default: cada 2 horas
    );

    this.logger.log(`📅 Registrando cron de renovaciones: ${cronSchedule}`);

    try {
      // Crear el cron job
      const job = new CronJob(
        cronSchedule,
        () => {
          this.processRenewals();
        },
        null,        // onComplete
        false,       // start (lo iniciamos manualmente abajo)
        'UTC',       // timezone
      );

      // Registrarlo en el registry
      this.schedulerRegistry.addCronJob('subscription-renewals', job);
      
      // Iniciar el job
      job.start();

      this.logger.log('✅ Cron de renovaciones registrado y activo');
      this.logger.log(`⏰ Próxima ejecución: ${job.nextDate().toString()}`);
    } catch (error) {
      this.logger.error(
        `❌ Error al registrar cron de renovaciones: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Procesar renovaciones automáticas
   * YA NO usa el decorador @Cron
   */
  async processRenewals(): Promise<void> {
    this.logger.warn('⏰ CRON EJECUTÁNDOSE - processRenewals()');
    
    const autoChargeEnabled = this.configService.get<boolean>(
      'subscriptions.autoChargeEnabled',
      true,
    );

    this.logger.log(`🔍 autoChargeEnabled: ${autoChargeEnabled}`);

    if (!autoChargeEnabled) {
      this.logger.debug('Cobro automático deshabilitado');
      return;
    }

    this.logger.log('🔄 Iniciando proceso de renovaciones automáticas...');

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
   * Usa decorador @Cron porque es un schedule fijo
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'subscription-downgrades',
    timeZone: 'UTC',
  })
  async processDowngrades(): Promise<void> {
    this.logger.warn('⏰ CRON EJECUTÁNDOSE - processDowngrades()');
    
    const autoDowngradeEnabled = this.configService.get<boolean>(
      'subscriptions.autoDowngradeEnabled',
      true,
    );

    if (!autoDowngradeEnabled) {
      this.logger.debug('Downgrade automático deshabilitado');
      return;
    }

    this.logger.log('📉 Iniciando proceso de downgrades automáticos...');

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
   * Usa decorador @Cron porque es un schedule fijo
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, {
    name: 'subscription-daily-stats',
    timeZone: 'UTC',
  })
  async logDailyStats(): Promise<void> {
    this.logger.warn('⏰ CRON EJECUTÁNDOSE - logDailyStats()');
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