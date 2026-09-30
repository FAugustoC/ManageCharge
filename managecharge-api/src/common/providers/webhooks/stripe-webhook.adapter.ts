import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { PaymentProvider } from '../../enums/payment-provider.enum.js';
import { WebhookEventType } from '../../enums/webhook-event-type.enum.js';
import { fromMinorUnits } from '../../constants/currency.constants.js';
import { getErrorMessage } from '../../utils/error.utils.js';
import type {
  IWebhookAdapter,
  NormalizedCardData,
  NormalizedWebhookEvent,
  WebhookRequest,
} from '../../interfaces/webhook-adapter.interface.js';
import {
  InvalidWebhookSignatureError,
  WebhookNotConfiguredError,
} from './webhook.errors.js';

/**
 * Stripe a veces devuelve un ID ("cus_123") y a veces el objeto completo
 * ({ id: "cus_123", ... }), según si el campo viene "expandido".
 * Esta función devuelve siempre solo el ID.
 */
function idOf(
  value: string | { id: string } | null | undefined,
): string | undefined {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.id;
}

/**
 * Adaptador de webhooks de Stripe
 *
 * @description Hace dos trabajos:
 * 1. Verificar que el webhook viene de Stripe (firma HMAC con
 *    STRIPE_WEBHOOK_SECRET sobre el cuerpo crudo).
 * 2. Traducir el evento de Stripe al formato común de ManageCharge.
 *
 * No toca la base de datos ni aplica reglas de negocio: solo verifica
 * y traduce. Eso lo mantiene pequeño y fácil de probar.
 */
@Injectable()
export class StripeWebhookAdapter implements IWebhookAdapter {
  readonly provider = PaymentProvider.STRIPE;
  private readonly logger = new Logger(StripeWebhookAdapter.name);

  constructor(private readonly configService: ConfigService) {
    // En producción la configuración ya exige el secreto (fail fast).
    // En desarrollo se permite arrancar sin él, pero se avisa una vez.
    if (!this.configService.get<string>('stripe.webhookSecret')) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET no está definido: los webhooks de Stripe ' +
          'responderán 503 hasta que lo configures.',
      );
    }
  }

  parseEvent({ rawBody, headers }: WebhookRequest): NormalizedWebhookEvent {
    const secret = this.configService.get<string>('stripe.webhookSecret');
    if (!secret) {
      throw new WebhookNotConfiguredError(
        'STRIPE_WEBHOOK_SECRET no está configurado',
      );
    }

    const signature = headers['stripe-signature'];
    if (typeof signature !== 'string' || signature === '') {
      throw new InvalidWebhookSignatureError(
        'Falta el header Stripe-Signature',
      );
    }

    let event: Stripe.Event;
    try {
      // constructEvent recalcula la firma con los bytes crudos y el
      // secreto. También rechaza eventos con más de 5 minutos de
      // antigüedad (protección contra "replay": alguien que captura un
      // webhook real e intenta reenviarlo después).
      event = Stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      throw new InvalidWebhookSignatureError(getErrorMessage(error));
    }

    return this.normalize(event);
  }

  /**
   * Traducir un evento de Stripe al formato común
   *
   * @description Gracias a los tipos de Stripe, dentro de cada "case"
   * TypeScript ya sabe qué objeto trae event.data.object (un
   * PaymentIntent, un Charge, una Dispute...). Eso se llama "narrowing".
   */
  private normalize(event: Stripe.Event): NormalizedWebhookEvent {
    const base = {
      provider: this.provider,
      eventId: event.id,
      originalType: event.type,
      occurredAt: new Date(event.created * 1000), // Stripe usa segundos
      livemode: event.livemode,
    };

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const lastError = intent.last_payment_error;
        return {
          ...base,
          type:
            event.type === 'payment_intent.succeeded'
              ? WebhookEventType.PAYMENT_SUCCEEDED
              : WebhookEventType.PAYMENT_FAILED,
          data: {
            transactionId: intent.id,
            customerId: idOf(intent.customer),
            paymentMethodId: idOf(intent.payment_method),
            tenantId: intent.metadata?.tenantId,
            amount: fromMinorUnits(intent.amount, intent.currency),
            currency: intent.currency.toUpperCase(),
            errorCode: lastError?.decline_code ?? lastError?.code,
            errorMessage: lastError?.message,
            metadata: { ...intent.metadata },
          },
        };
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        return {
          ...base,
          type: WebhookEventType.PAYMENT_REFUNDED,
          data: {
            // Guardamos el PaymentIntent (pi_...) porque es el ID que
            // registramos en SubscriptionTransaction.providerTransactionId
            transactionId: idOf(charge.payment_intent) ?? charge.id,
            customerId: idOf(charge.customer),
            tenantId: charge.metadata?.tenantId,
            amount: fromMinorUnits(charge.amount_refunded, charge.currency),
            currency: charge.currency.toUpperCase(),
          },
        };
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object;
        return {
          ...base,
          type: WebhookEventType.PAYMENT_DISPUTED,
          data: {
            transactionId: idOf(dispute.payment_intent) ?? idOf(dispute.charge),
            tenantId: dispute.metadata?.tenantId,
            amount: fromMinorUnits(dispute.amount, dispute.currency),
            currency: dispute.currency.toUpperCase(),
            errorCode: dispute.reason, // ej: 'fraudulent', 'product_not_received'
          },
        };
      }

      case 'payment_method.updated':
      case 'payment_method.automatically_updated': {
        const method = event.data.object;
        return {
          ...base,
          type: WebhookEventType.PAYMENT_METHOD_UPDATED,
          data: {
            paymentMethodId: method.id,
            customerId: idOf(method.customer),
            card: this.cardOf(method),
          },
        };
      }

      case 'payment_method.detached': {
        const method = event.data.object;
        // Al desvincularla, Stripe deja customer en null. El cliente
        // anterior viene en previous_attributes.
        const previous = event.data.previous_attributes as
          | { customer?: string | { id: string } | null }
          | undefined;
        return {
          ...base,
          type: WebhookEventType.PAYMENT_METHOD_DETACHED,
          data: {
            paymentMethodId: method.id,
            customerId: idOf(previous?.customer) ?? idOf(method.customer),
            card: this.cardOf(method),
          },
        };
      }

      default:
        // Stripe tiene cientos de tipos de evento. Los que no están
        // arriba se registran como "ignorados" y no se procesan.
        return { ...base, type: null, data: {} };
    }
  }

  private cardOf(method: Stripe.PaymentMethod): NormalizedCardData | undefined {
    if (!method.card) return undefined;
    return {
      last4: method.card.last4,
      brand: method.card.brand,
      expiryMonth: method.card.exp_month,
      expiryYear: method.card.exp_year,
    };
  }
}
