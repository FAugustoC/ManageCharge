import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { WebhookEventType } from '../enums/webhook-event-type.enum.js';

/**
 * Contrato de los adaptadores de webhooks
 *
 * @description Patrón Adapter: cada proveedor de pagos (Stripe hoy,
 * CyberSource mañana) envía sus webhooks con un formato, unos nombres
 * de evento y un método de firma DISTINTOS. Cada adaptador traduce su
 * formato a un "idioma común" (NormalizedWebhookEvent), y el resto de
 * ManageCharge solo habla ese idioma común.
 *
 * Resultado: agregar un proveedor nuevo = escribir un adaptador nuevo.
 * El controlador, el servicio y las reglas de negocio no cambian.
 *
 *   Stripe ──► StripeWebhookAdapter ─────┐
 *                                        ├──► NormalizedWebhookEvent ──► WebhooksService
 *   CyberSource ──► CyberSourceAdapter ──┘
 */

/**
 * Datos de la tarjeta (nunca el número completo, solo referencias)
 */
export interface NormalizedCardData {
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

/**
 * Datos del evento, ya traducidos
 *
 * @description Todos los campos son opcionales porque cada tipo de
 * evento trae información distinta (un reembolso trae monto, un cambio
 * de tarjeta trae la tarjeta).
 *
 * REGLA: los montos van en UNIDADES COMPLETAS (12.99 USD, no 1299),
 * igual que en el resto del sistema. El adaptador hace la conversión
 * con fromMinorUnits().
 */
export interface NormalizedWebhookData {
  /** ID del cobro en el proveedor (en Stripe: el PaymentIntent pi_...) */
  transactionId?: string;
  /** ID del cliente en el proveedor (cus_...) */
  customerId?: string;
  /** ID del método de pago (pm_...) */
  paymentMethodId?: string;
  /** Tenant al que pertenece, si el proveedor lo trae en la metadata */
  tenantId?: string;
  /** Monto en unidades completas */
  amount?: number;
  /** Código ISO 4217 en mayúsculas (USD, GTQ, CLP...) */
  currency?: string;
  /** Código de error o motivo (card_declined, fraudulent...) */
  errorCode?: string;
  /** Mensaje legible del error */
  errorMessage?: string;
  /** Datos de la tarjeta, en eventos de método de pago */
  card?: NormalizedCardData;
  /**
   * Metadata que ManageCharge adjuntó al crear el cobro
   * (ej: { tenantId, type: 'renewal', attempt: '2' })
   */
  metadata?: Record<string, string>;
}

/**
 * Evento de webhook en el "idioma común" de ManageCharge
 */
export interface NormalizedWebhookEvent {
  /** Proveedor que envió el evento */
  provider: PaymentProvider;
  /** ID único del evento EN EL PROVEEDOR (evt_...). Clave de idempotencia. */
  eventId: string;
  /** Nombre original del evento (ej: "payment_intent.succeeded"), para auditoría */
  originalType: string;
  /** Tipo traducido, o null si es un evento que no nos interesa */
  type: WebhookEventType | null;
  /** Cuándo ocurrió el evento en el proveedor */
  occurredAt: Date;
  /** true = modo real (live); false = modo de pruebas (test) */
  livemode: boolean;
  /** Datos traducidos */
  data: NormalizedWebhookData;
}

/**
 * Lo que el adaptador necesita de la petición HTTP
 *
 * @description No recibe el Request de Express completo: así el
 * adaptador no depende del framework y es fácil de probar.
 */
export interface WebhookRequest {
  /** Bytes EXACTOS del cuerpo (req.rawBody), necesarios para la firma */
  rawBody: Buffer;
  /** Headers de la petición (ahí viene la firma) */
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Contrato que cumple cada adaptador
 */
export interface IWebhookAdapter {
  /** Proveedor que atiende; también es el segmento de la URL (/webhooks/stripe) */
  readonly provider: PaymentProvider;

  /**
   * Verificar la firma y traducir el evento
   *
   * @throws InvalidWebhookSignatureError si la firma no es válida
   * @throws WebhookNotConfiguredError si falta el secreto del proveedor
   * (ambos definidos en common/providers/webhooks/webhook.errors.ts)
   */
  parseEvent(request: WebhookRequest): NormalizedWebhookEvent;
}
