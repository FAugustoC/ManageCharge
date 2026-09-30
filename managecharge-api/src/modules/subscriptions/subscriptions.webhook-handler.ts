import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { SubscriptionsService } from './subscriptions.service.js';
import { Tenant, TenantDocument } from '../tenants/index.js';
import {
  SubscriptionTransaction,
  SubscriptionTransactionDocument,
} from './entities/index.js';
import {
  SubscriptionPlan,
  SubscriptionStatus,
  TransactionStatus,
  TransactionType,
  WEBHOOK_ORPHAN_PAYMENT_MIN_AGE_MS,
} from '../../common/index.js';
import type { NormalizedWebhookEvent } from '../../common/index.js';
import { WebhookRetryLaterError } from '../../common/providers/webhooks/index.js';

/*
 * Las entidades guardan plan, status y type como string (así están
 * definidas en MongoDB). Estas listas permiten compararlos con los enums
 * sin mezclar tipos distintos.
 */

/** Tipos de cobro que extienden el período de una suscripción */
const PERIOD_PAYING_TYPES: string[] = [
  TransactionType.INITIAL,
  TransactionType.RENEWAL,
  TransactionType.MANUAL,
];

/** Estados de transacción que indican que el cobro ya se registró bien */
const SETTLED_STATUSES: string[] = [
  TransactionStatus.SUCCESS,
  TransactionStatus.REFUNDED,
];

/** Estados de suscripción desde los que se puede renovar */
const RENEWABLE_STATUSES: string[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE_PERIOD,
];

const FREE_PLAN: string = SubscriptionPlan.FREE;

/**
 * ID del tenant de una transacción como texto
 *
 * @description La entidad declara tenantId con el tipo del *esquema*
 * (Schema.Types.ObjectId); en tiempo de ejecución es un ObjectId, que
 * sí se convierte a texto correctamente.
 */
function tenantIdOf(transaction: SubscriptionTransactionDocument): string {
  return (transaction.tenantId as unknown as Types.ObjectId).toString();
}

/**
 * SubscriptionsWebhookHandler
 *
 * @description Reglas de negocio de las suscripciones que se disparan
 * con webhooks del proveedor de pagos. WebhooksService (que ya verificó
 * la firma y evitó duplicados) llama al método que corresponde a cada
 * tipo de evento.
 *
 * Cada método devuelve:
 * - true  → se aplicó una acción (el evento queda como "processed")
 * - false → no requería acción (el evento queda como "ignored")
 *
 * Reglas (decididas para ManageCharge):
 * - Cobro exitoso sin registro local ("huérfano"): si el tenant sigue
 *   vencido o en gracia, se renueva con las reglas de siempre. Si ya
 *   estaba al día, NO se renueva: se marca como posible doble cobro,
 *   para revisión, y se alerta al administrador.
 * - Reembolso total: se degrada al tenant a FREE.
 * - Disputa (contracargo): se degrada al tenant a FREE y se alerta.
 * - Excepción: si el cobro era un posible doble cobro, reembolsarlo o
 *   disputarlo NO afecta al tenant (ya pagó su período con otro cobro).
 * - Tarjeta actualizada por el banco: se actualizan los datos guardados.
 * - Tarjeta desvinculada en el proveedor: se alerta al administrador.
 */
@Injectable()
export class SubscriptionsWebhookHandler {
  private readonly logger = new Logger(SubscriptionsWebhookHandler.name);

  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,

    @InjectModel(SubscriptionTransaction.name)
    private readonly transactionModel: Model<SubscriptionTransactionDocument>,

    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Cobros
  // ─────────────────────────────────────────────────────────────

  /**
   * Cobro exitoso en el proveedor
   *
   * @description Casi siempre ya lo registró nuestro propio flujo (el
   * cobro es síncrono) y no hay nada que hacer. El caso importante es
   * el "cobro huérfano": el servidor se cayó después de que el proveedor
   * cobró pero antes de guardar la renovación. Sin esta conciliación, el
   * tenant seguiría en gracia y el cron le cobraría OTRA VEZ.
   */
  async handlePaymentSucceeded(
    event: NormalizedWebhookEvent,
  ): Promise<boolean> {
    const { transactionId, amount, currency } = event.data;

    if (!transactionId) {
      this.alertAdmin(
        'Cobro exitoso sin ID de transacción',
        `Evento ${event.eventId}`,
      );
      return false;
    }

    const existing = await this.transactionModel.findOne({
      providerTransactionId: transactionId,
    });

    // Caso normal: nuestro flujo ya lo registró como exitoso
    if (existing && SETTLED_STATUSES.includes(existing.status)) {
      this.logger.log(
        `Cobro ${transactionId} ya estaba registrado: nada que hacer`,
      );
      return false;
    }

    // Sin registro todavía: puede que nuestro flujo lo esté guardando en
    // este momento. Se espera antes de tratarlo como huérfano.
    // (Si existe como FAILED, nuestro flujo ya terminó: no hay que esperar.)
    if (!existing) {
      const ageMs = Date.now() - event.occurredAt.getTime();
      if (ageMs < WEBHOOK_ORPHAN_PAYMENT_MIN_AGE_MS) {
        throw new WebhookRetryLaterError(
          `Cobro ${transactionId} aún sin registro local ` +
            `(hace ${Math.round(ageMs / 1000)}s). Se esperará al reenvío.`,
        );
      }
    }

    const tenantId =
      (existing ? tenantIdOf(existing) : undefined) ??
      event.data.metadata?.tenantId ??
      event.data.tenantId;

    if (!tenantId) {
      this.alertAdmin(
        'Cobro exitoso sin tenant identificable',
        `Transacción ${transactionId} por ${amount} ${currency}. Revisar en el proveedor.`,
      );
      return false;
    }

    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) {
      this.alertAdmin(
        'Cobro exitoso de un tenant inexistente',
        `Tenant ${tenantId}, transacción ${transactionId} por ${amount} ${currency}.`,
      );
      return false;
    }

    const chargeType =
      this.resolveChargeType(existing?.type ?? event.data.metadata?.type) ??
      TransactionType.MANUAL;
    const subscription = tenant.subscription;
    const periodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;
    const now = new Date();

    const isPremium = subscription.plan !== FREE_PLAN;
    const isRenewableStatus = RENEWABLE_STATUSES.includes(subscription.status);
    const periodEnded = periodEnd !== null && periodEnd <= now;
    const matchesPrice =
      amount === subscription.amount &&
      currency === subscription.currency?.toUpperCase();
    const isRenewalCharge =
      chargeType === TransactionType.RENEWAL ||
      chargeType === TransactionType.MANUAL;

    // ── Regla 1: sigue vencido o en gracia → renovar ──
    let renewedByOtherProcess = false;
    if (
      periodEnd &&
      isRenewalCharge &&
      isPremium &&
      isRenewableStatus &&
      periodEnded &&
      matchesPrice
    ) {
      const renewed = await this.subscriptionsService.renewSubscription(
        tenant,
        transactionId,
        { onlyIfPeriodEnd: periodEnd },
      );

      if (renewed) {
        await this.saveSuccessfulCharge(existing, tenant, event, chargeType, {
          possibleDuplicate: false,
          requiresReview: false,
          reviewReason:
            'Conciliado por webhook: cobro exitoso sin registro local',
        });
        this.logger.warn(
          `🔧 Cobro huérfano ${transactionId} conciliado: tenant ${tenantId} renovado`,
        );
        return true;
      }
      // Si no se renovó, otro proceso lo hizo en el mismo instante:
      // este cobro sobra y cae en la regla 2.
      renewedByOtherProcess = true;
    }

    // ── Regla 2: ya estaba al día → posible doble cobro ──
    const alreadyPaid =
      renewedByOtherProcess ||
      (isPremium && periodEnd !== null && !periodEnded);
    const reviewReason = renewedByOtherProcess
      ? 'Posible doble cobro: otro proceso renovó la suscripción al mismo tiempo'
      : alreadyPaid && periodEnd
        ? `Posible doble cobro: el tenant ya tenía su período pagado hasta ${periodEnd.toISOString()}`
        : this.describeUnappliedCharge({
            isRenewalCharge,
            isPremium,
            isRenewableStatus,
            matchesPrice,
            chargeType,
          });

    await this.saveSuccessfulCharge(existing, tenant, event, chargeType, {
      possibleDuplicate: alreadyPaid,
      requiresReview: true,
      reviewReason,
    });

    this.alertAdmin(
      alreadyPaid ? 'Posible doble cobro' : 'Cobro exitoso sin aplicar',
      `Tenant ${tenantId} (${tenant.email}), transacción ${transactionId} por ` +
        `${amount} ${currency}. ${reviewReason}. Revisar y reembolsar si corresponde.`,
    );
    return true;
  }

  /**
   * Cobro rechazado en el proveedor
   *
   * @description Nuestro flujo de cobro ya maneja los rechazos (gracia,
   * reintentos, downgrade). Aquí solo se deja constancia.
   */
  async handlePaymentFailed(event: NormalizedWebhookEvent): Promise<boolean> {
    const { transactionId, errorCode } = event.data;

    const existing = transactionId
      ? await this.transactionModel.findOne({
          providerTransactionId: transactionId,
        })
      : null;

    this.logger.log(
      `Cobro rechazado ${transactionId ?? '(sin ID)'} (${errorCode ?? 'sin código'}): ` +
        (existing
          ? 'ya registrado'
          : 'sin registro local, lo maneja el flujo de cobro'),
    );
    return false;
  }

  /**
   * Reembolso (total o parcial)
   *
   * @description El proveedor envía el monto reembolsado ACUMULADO.
   * Se guarda el mayor visto, así el resultado es correcto aunque dos
   * reembolsos parciales lleguen en desorden.
   */
  async handlePaymentRefunded(event: NormalizedWebhookEvent): Promise<boolean> {
    const { transactionId } = event.data;
    const transaction = transactionId
      ? await this.transactionModel.findOne({
          providerTransactionId: transactionId,
        })
      : null;

    if (!transaction) {
      this.alertAdmin(
        'Reembolso de un cobro desconocido',
        `Transacción ${transactionId ?? '(sin ID)'} por ${event.data.amount} ${event.data.currency}.`,
      );
      return false;
    }

    const refundedAmount = Math.max(
      transaction.refundedAmount ?? 0,
      event.data.amount ?? 0,
    );
    const isFullRefund = refundedAmount >= transaction.amount;

    await this.transactionModel.updateOne(
      { _id: transaction._id },
      {
        $set: {
          refundedAmount,
          ...(isFullRefund && { status: TransactionStatus.REFUNDED }),
          // Reembolsar un posible doble cobro resuelve la revisión
          ...(isFullRefund &&
            transaction.possibleDuplicate && {
              requiresReview: false,
              reviewReason: `${transaction.reviewReason ?? ''} | Resuelto: reembolsado`,
            }),
        },
      },
    );

    this.logger.warn(
      `💸 Reembolso ${isFullRefund ? 'TOTAL' : 'parcial'} de ${transactionId}: ` +
        `${refundedAmount} de ${transaction.amount} ${transaction.currency}`,
    );

    if (!isFullRefund) return true;

    if (transaction.possibleDuplicate) {
      this.logger.log(
        `El cobro reembolsado era un posible doble cobro: el tenant conserva su plan`,
      );
      return true;
    }

    await this.downgradeIfPaidPeriod(transaction, 'payment_refunded');
    return true;
  }

  /**
   * Disputa (contracargo)
   *
   * @description El cliente reclamó el cobro a su banco. Se suspende el
   * premium y se alerta al administrador para que responda la disputa
   * en el proveedor (hay un plazo para enviar evidencia).
   */
  async handlePaymentDisputed(event: NormalizedWebhookEvent): Promise<boolean> {
    const { transactionId, errorCode: disputeReason } = event.data;
    const transaction = transactionId
      ? await this.transactionModel.findOne({
          providerTransactionId: transactionId,
        })
      : null;

    if (!transaction) {
      this.alertAdmin(
        'Disputa de un cobro desconocido',
        `Transacción ${transactionId ?? '(sin ID)'} por ${event.data.amount} ` +
          `${event.data.currency}. Motivo: ${disputeReason ?? 'desconocido'}.`,
      );
      return false;
    }

    await this.transactionModel.updateOne(
      { _id: transaction._id },
      {
        $set: {
          disputedAt: event.occurredAt,
          disputeReason,
          requiresReview: true,
          reviewReason: `Disputa abierta: ${disputeReason ?? 'motivo desconocido'}`,
        },
      },
    );

    this.alertAdmin(
      'Disputa abierta',
      `Tenant ${tenantIdOf(transaction)}, transacción ${transactionId} por ` +
        `${transaction.amount} ${transaction.currency}. Motivo: ${disputeReason ?? 'desconocido'}. ` +
        'Responde la disputa en el Dashboard del proveedor antes del plazo.',
    );

    if (transaction.possibleDuplicate) {
      this.logger.log(
        `La disputa es sobre un posible doble cobro: el tenant conserva su plan`,
      );
      return true;
    }

    await this.downgradeIfPaidPeriod(transaction, 'payment_disputed');
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Métodos de pago
  // ─────────────────────────────────────────────────────────────

  /**
   * El banco actualizó la tarjeta (nueva fecha de expiración, reemplazo)
   */
  async handlePaymentMethodUpdated(
    event: NormalizedWebhookEvent,
  ): Promise<boolean> {
    const { paymentMethodId, card } = event.data;
    if (!paymentMethodId || !card) return false;

    const fields: Record<string, string | number> = {};
    if (card.last4) fields['subscription.paymentMethod.last4'] = card.last4;
    if (card.brand) fields['subscription.paymentMethod.brand'] = card.brand;
    if (card.expiryMonth)
      fields['subscription.paymentMethod.expiryMonth'] = card.expiryMonth;
    if (card.expiryYear)
      fields['subscription.paymentMethod.expiryYear'] = card.expiryYear;

    if (Object.keys(fields).length === 0) return false;

    const tenant = await this.tenantModel.findOneAndUpdate(
      { 'subscription.paymentMethod.paymentMethodId': paymentMethodId },
      { $set: fields },
    );

    if (!tenant) {
      this.logger.debug(
        `Tarjeta ${paymentMethodId} no pertenece a ningún tenant`,
      );
      return false;
    }

    this.logger.log(
      `💳 Tarjeta del tenant ${tenant._id.toString()} actualizada por el banco ` +
        `(${card.brand ?? ''} ****${card.last4 ?? ''}, vence ${card.expiryMonth}/${card.expiryYear})`,
    );
    return true;
  }

  /**
   * La tarjeta se desvinculó en el proveedor
   *
   * @description Si fue el propio tenant al cambiar de tarjeta, la vieja
   * ya no es la suya y no hay nada que hacer. Si es su tarjeta ACTUAL
   * (alguien la quitó desde el Dashboard), los próximos cobros fallarán:
   * se alerta para contactarlo. No se borra la tarjeta del tenant: el
   * cobro fallido activará el flujo normal de gracia y reintentos.
   */
  async handlePaymentMethodDetached(
    event: NormalizedWebhookEvent,
  ): Promise<boolean> {
    const { paymentMethodId } = event.data;
    if (!paymentMethodId) return false;

    const tenant = await this.tenantModel.findOne({
      'subscription.paymentMethod.paymentMethodId': paymentMethodId,
    });

    if (!tenant) {
      this.logger.debug(
        `Tarjeta ${paymentMethodId} desvinculada: no es la tarjeta actual de ningún tenant`,
      );
      return false;
    }

    this.alertAdmin(
      'Tarjeta desvinculada en el proveedor',
      `Tenant ${tenant._id.toString()} (${tenant.email}). Su tarjeta actual ` +
        `(****${tenant.subscription.paymentMethod?.last4 ?? ''}) ya no puede cobrarse. ` +
        'Los próximos cobros fallarán hasta que registre otra.',
    );
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // Auxiliares
  // ─────────────────────────────────────────────────────────────

  /**
   * Degradar a FREE si la transacción pagaba un período y el tenant
   * todavía es premium
   */
  private async downgradeIfPaidPeriod(
    transaction: SubscriptionTransactionDocument,
    reason: string,
  ): Promise<void> {
    if (!PERIOD_PAYING_TYPES.includes(transaction.type)) return;

    const tenant = await this.tenantModel.findById(transaction.tenantId);
    if (!tenant || tenant.subscription.plan === FREE_PLAN) return;

    await this.subscriptionsService.downgradeToFree(tenant, reason);
  }

  /**
   * Guardar un cobro exitoso que llegó por webhook
   *
   * @description Si ya existía como FAILED (el cobro "falló" en nuestro
   * flujo pero el proveedor lo completó después), se corrige ese mismo
   * registro. Si no existía, se crea.
   */
  private async saveSuccessfulCharge(
    existing: SubscriptionTransactionDocument | null,
    tenant: TenantDocument,
    event: NormalizedWebhookEvent,
    chargeType: TransactionType,
    review: {
      possibleDuplicate: boolean;
      requiresReview: boolean;
      reviewReason: string;
    },
  ): Promise<void> {
    if (existing) {
      await this.transactionModel.updateOne(
        { _id: existing._id },
        {
          $set: { status: TransactionStatus.SUCCESS, ...review },
          $unset: { errorCode: '', errorMessage: '' },
        },
      );
      return;
    }

    await this.subscriptionsService.createTransaction({
      tenantId: tenant._id.toString(),
      type: chargeType,
      plan: tenant.subscription.plan,
      amount: event.data.amount ?? 0,
      currency: event.data.currency ?? tenant.subscription.currency,
      status: TransactionStatus.SUCCESS,
      provider: event.provider,
      providerTransactionId: event.data.transactionId,
      providerCustomerId: event.data.customerId,
      ...review,
      metadata: { initiatedBy: 'system', reason: 'Registrado por webhook' },
    });
  }

  /** Convertir el "type" de la metadata del cobro en TransactionType */
  private resolveChargeType(
    value: string | undefined,
  ): TransactionType | undefined {
    const types = Object.values(TransactionType) as string[];
    return value && types.includes(value)
      ? (value as TransactionType)
      : undefined;
  }

  /** Explicar por qué un cobro huérfano no se pudo aplicar */
  private describeUnappliedCharge(checks: {
    isRenewalCharge: boolean;
    isPremium: boolean;
    isRenewableStatus: boolean;
    matchesPrice: boolean;
    chargeType: TransactionType;
  }): string {
    if (!checks.isRenewalCharge) {
      return `Cobro de tipo "${checks.chargeType}" sin registro local: la suscripción no se activó`;
    }
    if (!checks.isPremium) return 'El tenant ya está en plan FREE';
    if (!checks.isRenewableStatus)
      return 'La suscripción está cancelada o expirada';
    if (!checks.matchesPrice)
      return 'El monto o la moneda no coinciden con el plan actual';
    return 'No se pudo renovar';
  }

  /**
   * Alerta para el administrador
   *
   * @description Por ahora queda como ERROR en los logs, con la etiqueta
   * [ALERTA ADMIN] para poder filtrarla. Cuando exista el módulo de
   * notificaciones, este método enviará además un correo al super admin.
   */
  private alertAdmin(subject: string, details: string): void {
    this.logger.error(`🚨 [ALERTA ADMIN] ${subject}: ${details}`);
  }
}
