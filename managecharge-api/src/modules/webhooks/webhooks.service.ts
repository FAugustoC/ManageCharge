import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  WEBHOOK_ADAPTERS,
  WEBHOOK_STALE_PROCESSING_MS,
  WebhookEventStatus,
  WebhookEventType,
  getErrorMessage,
  getErrorStack,
} from '../../common/index.js';
import type {
  IWebhookAdapter,
  NormalizedWebhookEvent,
  WebhookRequest,
} from '../../common/index.js';
import {
  InvalidWebhookSignatureError,
  WebhookNotConfiguredError,
  WebhookRetryLaterError,
} from '../../common/providers/webhooks/index.js';
import { WebhookEvent, WebhookEventDocument } from './entities/index.js';
import { SubscriptionsWebhookHandler } from '../subscriptions/index.js';

/** Respuesta que recibe el proveedor */
export interface WebhookHandleResult {
  received: true;
  /** true si el evento ya se había procesado antes */
  duplicate: boolean;
}

/** Resultado de intentar "reclamar" un evento para procesarlo */
type ClaimResult = 'claimed' | 'already_done' | 'in_progress';

/** Código de error de MongoDB cuando se viola un índice único */
const MONGO_DUPLICATE_KEY = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === MONGO_DUPLICATE_KEY
  );
}

/**
 * WebhooksService
 *
 * @description Recibe webhooks de cualquier proveedor y los procesa de
 * forma segura. El flujo es siempre el mismo:
 *
 *   1. Elegir el adaptador según la URL (/webhooks/stripe → Stripe)
 *   2. Verificar la firma y traducir el evento (lo hace el adaptador)
 *   3. Reclamar el evento en MongoDB (idempotencia: nunca dos veces)
 *   4. Despachar a la regla de negocio que corresponda
 *   5. Marcar el resultado: processed, ignored o failed
 *
 * Códigos HTTP que devuelve (el proveedor los interpreta así):
 * - 200: recibido. El proveedor NO lo reenvía.
 * - 400: firma inválida. Es un ataque o un error de configuración.
 * - 404: proveedor desconocido.
 * - 409: el mismo evento se está procesando ahora. Se reenviará luego.
 * - 500/503: falló o falta configuración. El proveedor lo reenvía.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  /** Adaptadores indexados por proveedor: 'stripe' → StripeWebhookAdapter */
  private readonly adapters: Map<string, IWebhookAdapter>;

  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly webhookEventModel: Model<WebhookEventDocument>,
    @Inject(WEBHOOK_ADAPTERS)
    adapters: IWebhookAdapter[],
    private readonly subscriptionsHandler: SubscriptionsWebhookHandler,
  ) {
    this.adapters = new Map(
      adapters.map((adapter) => [adapter.provider, adapter]),
    );
  }

  async handle(
    provider: string,
    request: WebhookRequest,
  ): Promise<WebhookHandleResult> {
    const event = this.parseEvent(provider, request);

    const claim = await this.claimEvent(event);

    if (claim === 'already_done') {
      this.logger.log(
        `Evento duplicado ignorado: ${event.provider}/${event.eventId}`,
      );
      return { received: true, duplicate: true };
    }

    if (claim === 'in_progress') {
      // Otra petición lo está procesando ahora mismo. Respondemos con
      // error para que el proveedor lo reenvíe más tarde: si esa otra
      // petición falla, el reenvío lo recupera.
      throw new ConflictException('El evento se está procesando');
    }

    try {
      const handled = await this.dispatch(event);

      await this.webhookEventModel.updateOne(
        { provider: event.provider, eventId: event.eventId },
        {
          $set: {
            status: handled
              ? WebhookEventStatus.PROCESSED
              : WebhookEventStatus.IGNORED,
            processedAt: new Date(),
          },
          $unset: { lastError: '' },
        },
      );

      return { received: true, duplicate: false };
    } catch (error) {
      // Caso esperado: hay que esperar (ej: nuestro flujo aún guarda el
      // cobro). No es un error del sistema: aviso y 409 para el reenvío.
      if (error instanceof WebhookRetryLaterError) {
        this.logger.warn(
          `Evento ${event.provider}/${event.eventId} pospuesto: ${error.message}`,
        );
        await this.webhookEventModel.updateOne(
          { provider: event.provider, eventId: event.eventId },
          {
            $set: {
              status: WebhookEventStatus.FAILED,
              lastError: error.message,
            },
          },
        );
        throw new ConflictException('El evento se procesará en un reenvío');
      }

      this.logger.error(
        `Error procesando ${event.provider}/${event.eventId} (${event.originalType})`,
        getErrorStack(error),
      );

      await this.webhookEventModel.updateOne(
        { provider: event.provider, eventId: event.eventId },
        {
          $set: {
            status: WebhookEventStatus.FAILED,
            lastError: getErrorMessage(error),
          },
        },
      );

      // 500 → el proveedor reintentará más tarde
      throw new InternalServerErrorException('Error procesando el webhook');
    }
  }

  /**
   * Pasos 1 y 2: elegir adaptador, verificar firma y traducir
   *
   * @description Convierte los errores del adaptador en respuestas HTTP.
   */
  private parseEvent(
    provider: string,
    request: WebhookRequest,
  ): NormalizedWebhookEvent {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new NotFoundException(
        `Proveedor de webhooks no soportado: ${provider}`,
      );
    }

    try {
      const event = adapter.parseEvent(request);
      this.logger.log(
        `Webhook recibido: ${event.provider}/${event.eventId} ` +
          `(${event.originalType}${event.livemode ? '' : ', modo test'})`,
      );
      return event;
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        this.logger.warn(
          `Firma de webhook inválida (${provider}): ${error.message}`,
        );
        throw new BadRequestException('Firma de webhook inválida');
      }
      if (error instanceof WebhookNotConfiguredError) {
        this.logger.error(
          `Webhooks de ${provider} sin configurar: ${error.message}`,
        );
        throw new ServiceUnavailableException('Webhooks no configurados');
      }
      throw error;
    }
  }

  /**
   * Paso 3: reclamar el evento (idempotencia)
   *
   * @description Intenta crear el registro. MongoDB garantiza con el
   * índice único que solo UNA petición puede crearlo, aunque lleguen
   * dos copias del mismo evento al mismo milisegundo.
   *
   * Si ya existía:
   * - processed / ignored → ya se hizo, no repetir
   * - failed, o processing abandonado → se retoma (reintento)
   * - processing reciente → otra petición lo está atendiendo
   */
  private async claimEvent(
    event: NormalizedWebhookEvent,
  ): Promise<ClaimResult> {
    const key = { provider: event.provider, eventId: event.eventId };

    try {
      await this.webhookEventModel.create({
        ...key,
        originalType: event.originalType,
        type: event.type,
        status: WebhookEventStatus.PROCESSING,
        attempts: 1,
        livemode: event.livemode,
        occurredAt: event.occurredAt,
        data: event.data,
      });
      return 'claimed';
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }

    // Ya existía: intentar retomarlo de forma atómica. findOneAndUpdate
    // con condición en el filtro asegura que solo una petición lo retome.
    const staleBefore = new Date(Date.now() - WEBHOOK_STALE_PROCESSING_MS);
    const reclaimed = await this.webhookEventModel.findOneAndUpdate(
      {
        ...key,
        $or: [
          { status: WebhookEventStatus.FAILED },
          {
            status: WebhookEventStatus.PROCESSING,
            updatedAt: { $lt: staleBefore },
          },
        ],
      },
      {
        $set: { status: WebhookEventStatus.PROCESSING },
        $inc: { attempts: 1 },
      },
      { new: true },
    );

    if (reclaimed) {
      this.logger.log(
        `Reintentando evento ${event.provider}/${event.eventId} (intento ${reclaimed.attempts})`,
      );
      return 'claimed';
    }

    const existing = await this.webhookEventModel.findOne(key);
    return existing?.status === WebhookEventStatus.PROCESSING
      ? 'in_progress'
      : 'already_done';
  }

  /**
   * Paso 4: despachar a la regla de negocio
   *
   * @returns true si se aplicó una acción; false si no requería acción
   *
   * @description Las reglas viven en el módulo al que pertenecen (las
   * de suscripciones en SubscriptionsWebhookHandler). Este servicio solo
   * decide a quién le toca cada tipo de evento.
   */
  private async dispatch(event: NormalizedWebhookEvent): Promise<boolean> {
    switch (event.type) {
      case WebhookEventType.PAYMENT_SUCCEEDED:
        return this.subscriptionsHandler.handlePaymentSucceeded(event);
      case WebhookEventType.PAYMENT_FAILED:
        return this.subscriptionsHandler.handlePaymentFailed(event);
      case WebhookEventType.PAYMENT_REFUNDED:
        return this.subscriptionsHandler.handlePaymentRefunded(event);
      case WebhookEventType.PAYMENT_DISPUTED:
        return this.subscriptionsHandler.handlePaymentDisputed(event);
      case WebhookEventType.PAYMENT_METHOD_UPDATED:
        return this.subscriptionsHandler.handlePaymentMethodUpdated(event);
      case WebhookEventType.PAYMENT_METHOD_DETACHED:
        return this.subscriptionsHandler.handlePaymentMethodDetached(event);
      case null:
        this.logger.debug(
          `Evento sin interés para ManageCharge: ${event.originalType}`,
        );
        return false;
    }
  }
}
